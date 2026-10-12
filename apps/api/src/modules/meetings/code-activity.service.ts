import { and, codeEvents, codeLinks, desc, eq, lt, projectEvents, type DbClient } from '@glasswork/db';
import {
  renderGithubEvent,
  type CodeEventView,
  type CodeLinkView,
  type CodeEventKind,
} from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { ProjectsService } from '../orders/projects.service';

const isUnique = (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505';

@Injectable()
export class CodeActivityService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly projectsSvc: ProjectsService,
    private readonly notifier: ProjectNotifier,
  ) {}

  private async seller(actor: RequestActor, projectId: string) {
    const { role } = await this.projectsSvc.access(actor, projectId);
    if (role !== 'seller') throw new UnprocessableEntityException('Only the seller can connect code');
  }

  async links(actor: RequestActor, projectId: string): Promise<CodeLinkView[]> {
    await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db.select().from(codeLinks).where(eq(codeLinks.projectId, projectId));
    return rows.map((r) => ({ id: r.id, repo: r.repo, createdAt: r.createdAt.toISOString() }));
  }

  async link(actor: RequestActor, projectId: string, repo: string): Promise<CodeLinkView> {
    await this.seller(actor, projectId);
    try {
      const [row] = await this.db.db
        .insert(codeLinks)
        .values({ projectId, repo, repoKey: repo.toLowerCase(), createdBy: actor.userId })
        .returning();
      this.notifier.changed(projectId, 'code.linked');
      return { id: row!.id, repo: row!.repo, createdAt: row!.createdAt.toISOString() };
    } catch (err) {
      if (isUnique(err)) throw new ConflictException('This repository is already connected');
      throw err;
    }
  }

  async unlink(actor: RequestActor, projectId: string, linkId: string) {
    await this.seller(actor, projectId);
    const del = await this.db.db
      .delete(codeLinks)
      .where(and(eq(codeLinks.id, linkId), eq(codeLinks.projectId, projectId)))
      .returning({ id: codeLinks.id });
    if (!del.length) throw new NotFoundException('Connection not found');
    this.notifier.changed(projectId, 'code.unlinked');
    return { ok: true };
  }

  async activity(actor: RequestActor, projectId: string, cursor: string | undefined, limit: number) {
    await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(codeEvents)
      .where(and(eq(codeEvents.projectId, projectId), cursor ? lt(codeEvents.id, cursor) : undefined))
      .orderBy(desc(codeEvents.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: page.map((r): CodeEventView => ({
        id: r.id,
        kind: r.kind as CodeEventKind,
        title: r.title,
        detail: r.detail,
        url: r.url,
        actor: r.actor,
        repo: r.repo,
        occurredAt: r.occurredAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? page.at(-1)!.id : null,
    };
  }

  /** Called with an already signature-verified webhook. Unknown repos and uninteresting events are ignored, not errors. */
  async ingest(event: string, deliveryId: string, payload: unknown): Promise<{ stored: number }> {
    const rendered = renderGithubEvent(event, payload);
    const repo = (payload as { repository?: { full_name?: unknown } } | null)?.repository?.full_name;
    if (!rendered || typeof repo !== 'string') return { stored: 0 };
    const links = await this.db.db.select().from(codeLinks).where(eq(codeLinks.repoKey, repo.toLowerCase()));
    let stored = 0;
    for (const l of links) {
      try {
        await this.db.db.insert(codeEvents).values({
          projectId: l.projectId,
          deliveryId,
          kind: rendered.kind,
          title: rendered.title.slice(0, 300),
          detail: rendered.detail?.slice(0, 300) ?? null,
          url: rendered.url && /^https:\/\//.test(rendered.url) ? rendered.url.slice(0, 500) : null,
          actor: rendered.actor?.slice(0, 100) ?? null,
          repo: l.repo,
          occurredAt: rendered.occurredAt,
        });
        await this.db.db.insert(projectEvents).values({
          projectId: l.projectId,
          actorId: null,
          type: `code.${rendered.kind}`,
          payload: { title: rendered.title },
        });
        this.notifier.changed(l.projectId, `code.${rendered.kind}`);
        stored++;
      } catch (err) {
        if (!isUnique(err)) throw err; // a redelivery of the same event: already stored
      }
    }
    return { stored };
  }
}
