import {
  and,
  asc,
  auditLogs,
  changeRequests,
  desc,
  eq,
  milestones,
  profiles,
  projects,
  sql,
  type DbClient,
} from '@glasswork/db';
import type { ChangeRequestInput, ChangeRequestView } from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { recordChange } from './commerce.util';
import { ProjectsService } from './projects.service';

const DAY_MS = 86_400_000;
const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Formal scope changes (brief §8.6). Either party proposes; the OTHER party answers. Acceptance appends the new
 * milestones (unfunded, so the buyer must fund them like any milestone), raises the project total and shifts the
 * open milestones' planned dates. Nothing here ever touches funds that are already held.
 */
@Injectable()
export class ChangeRequestsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly projectsSvc: ProjectsService,
    private readonly notifier: ProjectNotifier,
  ) {}

  private async view(
    actor: RequestActor,
    rows: (typeof changeRequests.$inferSelect)[],
  ): Promise<ChangeRequestView[]> {
    if (!rows.length) return [];
    const names = await this.db.db.select({ id: profiles.userId, name: profiles.displayName }).from(profiles);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      description: r.description,
      priceDeltaAmount: r.priceDeltaAmount,
      daysDelta: r.daysDelta,
      milestones: (r.milestoneChanges as { title: string; amount: number; days: number }[]).map((m) => ({
        title: m.title,
        amount: m.amount,
        days: m.days,
      })),
      status: r.status,
      requestedBy: { id: r.requestedBy, name: names.find((n) => n.id === r.requestedBy)?.name ?? 'Unknown' },
      canRespond: r.status === 'proposed' && r.requestedBy !== actor.userId,
      canWithdraw: r.status === 'proposed' && r.requestedBy === actor.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async list(actor: RequestActor, projectId: string) {
    await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.projectId, projectId))
      .orderBy(desc(changeRequests.id));
    return this.view(actor, rows);
  }

  async propose(actor: RequestActor, projectId: string, input: ChangeRequestInput) {
    const { project } = await this.projectsSvc.access(actor, projectId);
    if (project.status !== 'active')
      throw new UnprocessableEntityException(
        `Scope changes can be proposed while the project is active (now ${project.status})`,
      );
    const price = input.milestones.reduce((s, m) => s + m.amount, 0);
    await this.db.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'change:' + projectId}))`);
      const [open] = await tx
        .select({ id: changeRequests.id })
        .from(changeRequests)
        .where(and(eq(changeRequests.projectId, projectId), eq(changeRequests.status, 'proposed')));
      if (open) throw new UnprocessableEntityException('Answer or withdraw the open change request first');
      const [cr] = await tx
        .insert(changeRequests)
        .values({
          projectId,
          requestedBy: actor.userId,
          title: input.title,
          description: input.description,
          priceDeltaAmount: price,
          daysDelta: input.daysDelta,
          milestoneChanges: input.milestones,
        })
        .returning();
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: 'change.proposed',
        entityType: 'change_request',
        entityId: cr!.id,
        after: { price, days: input.daysDelta },
        payload: { title: input.title, price, days: input.daysDelta },
      });
    });
    await this.notifier.direct(
      projectId,
      actor.userId,
      'change.requested',
      `Scope change proposed: ${input.title}`,
      input.description.slice(0, 200),
    );
    return this.list(actor, projectId);
  }

  private async owned(projectId: string, id: string) {
    const [cr] = await this.db.db
      .select()
      .from(changeRequests)
      .where(and(eq(changeRequests.id, id), eq(changeRequests.projectId, projectId)));
    if (!cr) throw new NotFoundException('Change request not found');
    return cr;
  }

  async withdraw(actor: RequestActor, projectId: string, id: string) {
    await this.projectsSvc.access(actor, projectId);
    const cr = await this.owned(projectId, id);
    if (cr.requestedBy !== actor.userId)
      throw new UnprocessableEntityException('Only the proposer can withdraw it');
    await this.close(actor, cr, 'withdrawn');
    return this.list(actor, projectId);
  }

  async decline(actor: RequestActor, projectId: string, id: string) {
    await this.projectsSvc.access(actor, projectId);
    const cr = await this.owned(projectId, id);
    if (cr.requestedBy === actor.userId)
      throw new UnprocessableEntityException('The other party answers a change request');
    await this.close(actor, cr, 'declined');
    await this.notifier.direct(
      projectId,
      actor.userId,
      'change.decided',
      `Scope change declined: ${cr.title}`,
    );
    return this.list(actor, projectId);
  }

  private async close(
    actor: RequestActor,
    cr: typeof changeRequests.$inferSelect,
    status: 'declined' | 'withdrawn',
  ) {
    await this.db.db.transaction(async (tx) => {
      const upd = await tx
        .update(changeRequests)
        .set({ status, respondedBy: actor.userId, respondedAt: new Date() })
        .where(and(eq(changeRequests.id, cr.id), eq(changeRequests.status, 'proposed')))
        .returning({ id: changeRequests.id });
      if (!upd.length)
        throw new UnprocessableEntityException(`A ${cr.status} change request cannot be ${status}`);
      await recordChange(tx, {
        projectId: cr.projectId,
        actorId: actor.userId,
        type: `change.${status}`,
        entityType: 'change_request',
        entityId: cr.id,
        payload: { title: cr.title },
      });
    });
  }

  async accept(actor: RequestActor, projectId: string, id: string) {
    await this.projectsSvc.access(actor, projectId);
    await this.db.db.transaction(async (tx) => {
      const [p] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
      const [cr] = await tx
        .select()
        .from(changeRequests)
        .where(and(eq(changeRequests.id, id), eq(changeRequests.projectId, projectId)))
        .for('update');
      if (!p || !cr) throw new NotFoundException('Change request not found');
      if (cr.requestedBy === actor.userId)
        throw new UnprocessableEntityException('The other party answers a change request');
      if (cr.status !== 'proposed')
        throw new UnprocessableEntityException(`A ${cr.status} change request cannot be accepted`);
      if (p.status !== 'active')
        throw new UnprocessableEntityException(`The project is ${p.status}; it cannot change scope now`);

      const existing = await tx
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
        .orderBy(asc(milestones.position));
      const open = existing.filter((m) => !['released', 'cancelled', 'refunded'].includes(m.status));
      if (cr.daysDelta > 0) {
        for (const m of open)
          if (m.plannedDue)
            await tx
              .update(milestones)
              .set({ plannedDue: addDays(m.plannedDue, cr.daysDelta) })
              .where(eq(milestones.id, m.id));
      }
      const added = cr.milestoneChanges as {
        title: string;
        acceptanceCriteria?: string | null;
        amount: number;
        days: number;
      }[];
      let position = Math.max(0, ...existing.map((m) => m.position));
      let due =
        existing
          .map((m) => m.plannedDue)
          .filter((d): d is string => Boolean(d))
          .sort()
          .at(-1) ?? new Date().toISOString().slice(0, 10);
      if (cr.daysDelta > 0) due = addDays(due, cr.daysDelta);
      for (const m of added) {
        position += 1;
        due = addDays(due, m.days);
        await tx.insert(milestones).values({
          projectId,
          position,
          title: m.title,
          acceptanceCriteria: m.acceptanceCriteria ?? null,
          amount: m.amount,
          currency: p.currency,
          plannedDue: due,
        });
      }
      await tx
        .update(projects)
        .set({ totalAmount: p.totalAmount + cr.priceDeltaAmount })
        .where(eq(projects.id, projectId));
      await tx
        .update(changeRequests)
        .set({ status: 'accepted', respondedBy: actor.userId, respondedAt: new Date() })
        .where(eq(changeRequests.id, id));
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: 'change.accepted',
        entityType: 'change_request',
        entityId: id,
        before: { total: p.totalAmount },
        after: {
          total: p.totalAmount + cr.priceDeltaAmount,
          addedMilestones: added.length,
          daysDelta: cr.daysDelta,
        },
        payload: { title: cr.title, price: cr.priceDeltaAmount, days: cr.daysDelta },
      });
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'change_request.accepted',
        entityType: 'change_request',
        entityId: id,
        after: { price: cr.priceDeltaAmount },
      });
    });
    await this.notifier.direct(
      projectId,
      actor.userId,
      'change.decided',
      'Scope change accepted',
      'New milestones are waiting to be funded.',
    );
    return this.list(actor, projectId);
  }
}
