import {
  and,
  asc,
  deliverableFeedback,
  deliverables,
  desc,
  eq,
  files,
  inArray,
  lt,
  milestones,
  or,
  previewLinks,
  profiles,
  projectEvents,
  projects,
  sql,
  taskComments,
  tasks,
  type DbClient,
} from '@glasswork/db';
import {
  EVENT_FILTER_PREFIXES,
  TASK_STATUSES,
  type DeliverableView,
  type FeedbackView,
  type PreviewView,
  type ProjectEventView,
  type TaskCommentView,
  type TaskInput,
  type TaskPatch,
  type TaskSource,
  type TaskStatus,
  type TaskView,
} from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { recordChange } from '../orders/commerce.util';
import { StorageService } from '../files/storage.service';

type Anchor = FeedbackView['anchor'];

@Injectable()
export class RoomService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly access: AccessService,
    private readonly notifier: ProjectNotifier,
    private readonly storage: StorageService,
  ) {}

  // ---- guards ----------------------------------------------------------------------------

  /** Participant check (404 for everyone else) plus a project that is still editable when `write` is set. */
  private async member(
    actor: RequestActor,
    projectId: string,
    opts: { seller?: boolean; write?: boolean } = {},
  ) {
    const role = await this.access.projectRole(actor.userId, projectId);
    if (!role) throw new NotFoundException('Project not found');
    if (opts.seller && role !== 'seller')
      throw new UnprocessableEntityException('Only the seller can do this');
    const [p] = await this.db.db
      .select({ status: projects.status })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!p) throw new NotFoundException('Project not found');
    if (opts.write && ['cancelled', 'completed', 'reviewed'].includes(p.status)) {
      throw new UnprocessableEntityException(`The project is ${p.status}; it can no longer be changed`);
    }
    return { role, status: p.status };
  }

  private async names(ids: (string | null)[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!uniq.length) return new Map();
    const rows = await this.db.db
      .select({ id: profiles.userId, name: profiles.displayName })
      .from(profiles)
      .where(inArray(profiles.userId, uniq));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ---- board -------------------------------------------------------------------------------

  async board(actor: RequestActor, projectId: string) {
    await this.member(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.sortOrder), asc(tasks.id));
    const counts = rows.length
      ? await this.db.db
          .select({ taskId: taskComments.taskId, n: sql<number>`count(*)::int` })
          .from(taskComments)
          .where(
            inArray(
              taskComments.taskId,
              rows.map((r) => r.id),
            ),
          )
          .groupBy(taskComments.taskId)
      : [];
    const names = await this.names(rows.map((r) => r.assigneeId));
    const view = (t: typeof tasks.$inferSelect): TaskView => ({
      id: t.id,
      milestoneId: t.milestoneId,
      title: t.title,
      description: t.description,
      status: t.status,
      sortOrder: t.sortOrder,
      assignee: t.assigneeId ? { id: t.assigneeId, name: names.get(t.assigneeId) ?? 'Unknown' } : null,
      commentCount: counts.find((c) => c.taskId === t.id)?.n ?? 0,
      createdAt: t.createdAt.toISOString(),
    });
    const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskView[]])) as Record<
      TaskStatus,
      TaskView[]
    >;
    for (const t of rows) columns[t.status].push(view(t));
    return { columns };
  }

  private async validateTaskRefs(projectId: string, milestoneId?: string | null, assigneeId?: string | null) {
    if (milestoneId) {
      const [m] = await this.db.db
        .select({ id: milestones.id })
        .from(milestones)
        .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
      if (!m) throw new NotFoundException('Milestone not found');
    }
    if (assigneeId && !(await this.access.projectRole(assigneeId, projectId))) {
      throw new UnprocessableEntityException('The assignee must be a participant of this project');
    }
  }

  async createTask(actor: RequestActor, projectId: string, input: TaskInput) {
    await this.member(actor, projectId, { seller: true, write: true });
    await this.validateTaskRefs(projectId, input.milestoneId, input.assigneeId);
    const task = await this.db.db.transaction(async (tx) => {
      const [max] = await tx
        .select({ n: sql<number>`coalesce(max(${tasks.sortOrder}), -10)::int` })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, input.status)));
      const [t] = await tx
        .insert(tasks)
        .values({
          projectId,
          milestoneId: input.milestoneId ?? null,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          assigneeId: input.assigneeId ?? null,
          sortOrder: (max?.n ?? -10) + 10,
          createdBy: actor.userId,
        })
        .returning();
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: 'task.created',
        entityType: 'task',
        entityId: t!.id,
        after: { title: t!.title, status: t!.status },
        payload: { taskId: t!.id, title: t!.title },
      });
      return t!;
    });
    this.notifier.changed(projectId, 'task.created');
    return { taskId: task.id, ...(await this.board(actor, projectId)) };
  }

  /** Creates several to-do tasks in one transaction (e.g. confirmed AI suggestions from meeting notes). */
  async createMany(
    actor: RequestActor,
    projectId: string,
    items: { title: string; description?: string | null }[],
    opts: { milestoneId?: string | null; source: TaskSource },
  ): Promise<{ created: number }> {
    await this.member(actor, projectId, { seller: true, write: true });
    await this.validateTaskRefs(projectId, opts.milestoneId);
    await this.db.db.transaction(async (tx) => {
      const [max] = await tx
        .select({ n: sql<number>`coalesce(max(${tasks.sortOrder}), -10)::int` })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, 'todo')));
      let order = (max?.n ?? -10) + 10;
      for (const it of items) {
        const [t] = await tx
          .insert(tasks)
          .values({
            projectId,
            milestoneId: opts.milestoneId ?? null,
            title: it.title,
            description: it.description || null,
            status: 'todo',
            sortOrder: order,
            source: opts.source,
            createdBy: actor.userId,
          })
          .returning();
        order += 10;
        await recordChange(tx, {
          projectId,
          actorId: actor.userId,
          type: 'task.created',
          entityType: 'task',
          entityId: t!.id,
          after: { title: t!.title, status: t!.status, source: opts.source },
          payload: { taskId: t!.id, title: t!.title, source: opts.source },
        });
      }
    });
    this.notifier.changed(projectId, 'task.created');
    return { created: items.length };
  }

  async updateTask(actor: RequestActor, projectId: string, taskId: string, patch: TaskPatch) {
    await this.member(actor, projectId, { seller: true, write: true });
    await this.validateTaskRefs(projectId, patch.milestoneId, patch.assigneeId);
    await this.db.db.transaction(async (tx) => {
      const [t] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
        .for('update');
      if (!t) throw new NotFoundException('Task not found');
      const { position, ...fields } = patch;
      const to = fields.status ?? t.status;
      await tx.update(tasks).set(fields).where(eq(tasks.id, taskId));

      if (position !== undefined || to !== t.status) {
        // Re-sequence the destination column so ordering stays stable and gap-based.
        const column = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.status, to)))
          .orderBy(asc(tasks.sortOrder), asc(tasks.id));
        const others = column.filter((c) => c.id !== taskId).map((c) => c.id);
        others.splice(Math.min(position ?? others.length, others.length), 0, taskId);
        for (const [i, id] of others.entries())
          await tx
            .update(tasks)
            .set({ sortOrder: i * 10 })
            .where(eq(tasks.id, id));
      }
      if (to !== t.status) {
        await recordChange(tx, {
          projectId,
          actorId: actor.userId,
          type: 'task.moved',
          entityType: 'task',
          entityId: taskId,
          before: { status: t.status },
          after: { status: to },
          payload: { taskId, title: fields.title ?? t.title, from: t.status, to },
        });
      }
    });
    this.notifier.changed(projectId, 'task.updated');
    return this.board(actor, projectId);
  }

  async deleteTask(actor: RequestActor, projectId: string, taskId: string) {
    await this.member(actor, projectId, { seller: true, write: true });
    const del = await this.db.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
      .returning({ id: tasks.id });
    if (!del.length) throw new NotFoundException('Task not found');
    this.notifier.changed(projectId, 'task.deleted');
    return this.board(actor, projectId);
  }

  private async taskInProject(projectId: string, taskId: string) {
    const [t] = await this.db.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  async listComments(actor: RequestActor, projectId: string, taskId: string): Promise<TaskCommentView[]> {
    await this.member(actor, projectId);
    await this.taskInProject(projectId, taskId);
    const rows = await this.db.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.id));
    const names = await this.names(rows.map((r) => r.authorId));
    return rows.map((r) => ({
      id: r.id,
      author: { id: r.authorId, name: r.authorId ? (names.get(r.authorId) ?? 'Unknown') : 'Deleted user' },
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Buyer and seller may both comment (brief §8.1: "buyer views and comments, seller manages"). */
  async addComment(actor: RequestActor, projectId: string, taskId: string, body: string) {
    await this.member(actor, projectId, { write: true });
    const t = await this.taskInProject(projectId, taskId);
    await this.db.db.transaction(async (tx) => {
      const [c] = await tx.insert(taskComments).values({ taskId, authorId: actor.userId, body }).returning();
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: 'task.commented',
        entityType: 'task_comment',
        entityId: c!.id,
        payload: { taskId, title: t.title },
      });
    });
    await this.notifier.direct(
      projectId,
      actor.userId,
      'task.comment',
      `New comment on “${t.title}”`,
      body.slice(0, 200),
    );
    return this.listComments(actor, projectId, taskId);
  }

  // ---- deliverables ---------------------------------------------------------------------------

  async addDeliverable(actor: RequestActor, milestoneId: string, input: { fileId: string; note?: string }) {
    const [m] = await this.db.db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!m) throw new NotFoundException('Milestone not found');
    await this.member(actor, m.projectId, { seller: true, write: true });
    if (!['in_progress', 'revision_requested'].includes(m.status)) {
      throw new UnprocessableEntityException(
        `Deliverables can only be added while a milestone is in progress or needs changes (now ${m.status})`,
      );
    }
    const [file] = await this.db.db
      .select()
      .from(files)
      .where(and(eq(files.id, input.fileId), eq(files.ownerId, actor.userId)));
    // Someone else's file looks exactly like a missing one (D-011).
    if (!file) throw new NotFoundException('File not found');
    if (file.purpose !== 'deliverable' || file.status !== 'clean') {
      throw new UnprocessableEntityException('The file must be a completed, scanned deliverable upload');
    }
    const id = await this.db.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'deliverable:' + milestoneId}))`);
      const [v] = await tx
        .select({ n: sql<number>`coalesce(max(${deliverables.version}), 0)::int` })
        .from(deliverables)
        .where(eq(deliverables.milestoneId, milestoneId));
      await tx
        .update(deliverables)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(deliverables.milestoneId, milestoneId),
            inArray(deliverables.status, ['submitted', 'revision_requested']),
          ),
        );
      const [d] = await tx
        .insert(deliverables)
        .values({
          projectId: m.projectId,
          milestoneId,
          version: (v?.n ?? 0) + 1,
          fileId: file.id,
          note: input.note ?? null,
          submittedBy: actor.userId,
        })
        .returning();
      await recordChange(tx, {
        projectId: m.projectId,
        actorId: actor.userId,
        type: 'deliverable.uploaded',
        entityType: 'deliverable',
        entityId: d!.id,
        after: { version: d!.version, file: file.originalName },
        payload: { milestoneId, version: d!.version, fileName: file.originalName },
      });
      return d!.id;
    });
    await this.notifier.direct(
      m.projectId,
      actor.userId,
      'deliverable.uploaded',
      `New deliverable on ${m.title}`,
      `${file.originalName} (version ${await this.versionOf(id)})`,
    );
    return this.deliverableById(actor, id);
  }

  private async versionOf(id: string) {
    const [d] = await this.db.db
      .select({ v: deliverables.version })
      .from(deliverables)
      .where(eq(deliverables.id, id));
    return d?.v ?? 1;
  }

  async listDeliverables(actor: RequestActor, projectId: string): Promise<DeliverableView[]> {
    await this.member(actor, projectId);
    const rows = await this.db.db
      .select({ d: deliverables, f: files })
      .from(deliverables)
      .innerJoin(files, eq(files.id, deliverables.fileId))
      .where(eq(deliverables.projectId, projectId))
      .orderBy(asc(deliverables.milestoneId), desc(deliverables.version));
    return this.toDeliverableViews(rows);
  }

  private async deliverableById(actor: RequestActor, id: string): Promise<DeliverableView> {
    const [row] = await this.db.db
      .select({ d: deliverables, f: files })
      .from(deliverables)
      .innerJoin(files, eq(files.id, deliverables.fileId))
      .where(eq(deliverables.id, id));
    if (!row) throw new NotFoundException('Deliverable not found');
    await this.member(actor, row.d.projectId);
    return (await this.toDeliverableViews([row]))[0]!;
  }

  private async toDeliverableViews(
    rows: { d: typeof deliverables.$inferSelect; f: typeof files.$inferSelect }[],
  ): Promise<DeliverableView[]> {
    if (!rows.length) return [];
    const fb = await this.db.db
      .select()
      .from(deliverableFeedback)
      .where(
        inArray(
          deliverableFeedback.deliverableId,
          rows.map((r) => r.d.id),
        ),
      )
      .orderBy(asc(deliverableFeedback.id));
    const names = await this.names([...rows.map((r) => r.d.submittedBy), ...fb.map((f) => f.authorId)]);
    const who = (id: string | null) => ({ id, name: id ? (names.get(id) ?? 'Unknown') : 'Deleted user' });
    return rows.map(({ d, f }) => ({
      id: d.id,
      milestoneId: d.milestoneId,
      version: d.version,
      status: d.status,
      note: d.note,
      file: {
        id: f.id,
        name: f.originalName,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        status: f.status,
      },
      submittedBy: who(d.submittedBy),
      feedback: fb
        .filter((x) => x.deliverableId === d.id)
        .map((x) => ({
          id: x.id,
          author: who(x.authorId),
          anchor: x.anchor as Anchor,
          body: x.body,
          resolved: x.resolved,
          createdAt: x.createdAt.toISOString(),
        })),
      createdAt: d.createdAt.toISOString(),
    }));
  }

  /** Presigned download for a project participant, only when the file is scanned clean (AccessService policy). */
  async downloadDeliverable(actor: RequestActor, deliverableId: string) {
    const [d] = await this.db.db.select().from(deliverables).where(eq(deliverables.id, deliverableId));
    if (!d || !(await this.access.projectRole(actor.userId, d.projectId)))
      throw new NotFoundException('Deliverable not found');
    const file = await this.access.readableFile(actor.userId, d.fileId);
    if (!file) throw new NotFoundException('The file is not available (it may still be scanning)');
    return { url: await this.storage.presignGet(file.storageKey, file.originalName), expiresInSeconds: 300 };
  }

  async addFeedback(actor: RequestActor, deliverableId: string, input: { anchor: Anchor; body: string }) {
    const [d] = await this.db.db.select().from(deliverables).where(eq(deliverables.id, deliverableId));
    if (!d) throw new NotFoundException('Deliverable not found');
    await this.member(actor, d.projectId, { write: true });
    await this.db.db.transaction(async (tx) => {
      const [f] = await tx
        .insert(deliverableFeedback)
        .values({ deliverableId, authorId: actor.userId, anchor: input.anchor, body: input.body })
        .returning();
      await recordChange(tx, {
        projectId: d.projectId,
        actorId: actor.userId,
        type: 'deliverable.feedback',
        entityType: 'deliverable_feedback',
        entityId: f!.id,
        payload: { deliverableId, version: d.version },
      });
    });
    await this.notifier.direct(
      d.projectId,
      actor.userId,
      'deliverable.feedback',
      `New feedback on deliverable v${d.version}`,
      input.body.slice(0, 200),
    );
    return this.deliverableById(actor, deliverableId);
  }

  async setFeedbackResolved(actor: RequestActor, feedbackId: string, resolved: boolean) {
    const [row] = await this.db.db
      .select({ f: deliverableFeedback, projectId: deliverables.projectId })
      .from(deliverableFeedback)
      .innerJoin(deliverables, eq(deliverables.id, deliverableFeedback.deliverableId))
      .where(eq(deliverableFeedback.id, feedbackId));
    if (!row) throw new NotFoundException('Feedback not found');
    await this.member(actor, row.projectId, { write: true });
    await this.db.db
      .update(deliverableFeedback)
      .set({ resolved })
      .where(eq(deliverableFeedback.id, feedbackId));
    this.notifier.changed(row.projectId, 'deliverable.feedback_resolved');
    return this.deliverableById(actor, row.f.deliverableId);
  }

  // ---- previews -----------------------------------------------------------------------------

  async listPreviews(actor: RequestActor, projectId: string): Promise<PreviewView[]> {
    await this.member(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(previewLinks)
      .where(eq(previewLinks.projectId, projectId))
      .orderBy(desc(previewLinks.lastUpdatedAt));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      url: r.url,
      milestoneId: r.milestoneId,
      lastUpdatedAt: r.lastUpdatedAt.toISOString(),
    }));
  }

  async savePreview(
    actor: RequestActor,
    projectId: string,
    input: { kind: PreviewView['kind']; label: string; url: string; milestoneId?: string | null },
    previewId?: string,
  ) {
    await this.member(actor, projectId, { seller: true, write: true });
    if (input.milestoneId) {
      const [m] = await this.db.db
        .select({ id: milestones.id })
        .from(milestones)
        .where(and(eq(milestones.id, input.milestoneId), eq(milestones.projectId, projectId)));
      if (!m) throw new NotFoundException('Milestone not found');
    }
    await this.db.db.transaction(async (tx) => {
      let id = previewId;
      if (previewId) {
        const upd = await tx
          .update(previewLinks)
          .set({
            kind: input.kind,
            label: input.label,
            url: input.url,
            milestoneId: input.milestoneId ?? null,
            lastUpdatedAt: new Date(),
          })
          .where(and(eq(previewLinks.id, previewId), eq(previewLinks.projectId, projectId)))
          .returning({ id: previewLinks.id });
        if (!upd.length) throw new NotFoundException('Preview link not found');
      } else {
        const [row] = await tx
          .insert(previewLinks)
          .values({
            projectId,
            kind: input.kind,
            label: input.label,
            url: input.url,
            milestoneId: input.milestoneId ?? null,
            createdBy: actor.userId,
          })
          .returning({ id: previewLinks.id });
        id = row!.id;
      }
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: previewId ? 'preview.updated' : 'preview.added',
        entityType: 'preview_link',
        entityId: id!,
        payload: { kind: input.kind, label: input.label },
      });
    });
    this.notifier.changed(projectId, 'preview.updated');
    return this.listPreviews(actor, projectId);
  }

  async deletePreview(actor: RequestActor, projectId: string, previewId: string) {
    await this.member(actor, projectId, { seller: true, write: true });
    const del = await this.db.db
      .delete(previewLinks)
      .where(and(eq(previewLinks.id, previewId), eq(previewLinks.projectId, projectId)))
      .returning({ id: previewLinks.id });
    if (!del.length) throw new NotFoundException('Preview link not found');
    this.notifier.changed(projectId, 'preview.deleted');
    return this.listPreviews(actor, projectId);
  }

  // ---- activity feed --------------------------------------------------------------------------

  async events(
    actor: RequestActor,
    projectId: string,
    filter: keyof typeof EVENT_FILTER_PREFIXES,
    cursor: string | undefined,
    limit: number,
  ) {
    await this.member(actor, projectId);
    const prefixes = EVENT_FILTER_PREFIXES[filter];
    const like = prefixes.length
      ? or(
          ...prefixes.map((p) =>
            p.endsWith('.') ? sql`${projectEvents.type} like ${p + '%'}` : eq(projectEvents.type, p),
          ),
        )
      : undefined;
    const rows = await this.db.db
      .select()
      .from(projectEvents)
      .where(
        and(eq(projectEvents.projectId, projectId), cursor ? lt(projectEvents.id, cursor) : undefined, like),
      )
      .orderBy(desc(projectEvents.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const names = await this.names(page.map((r) => r.actorId));
    const items: ProjectEventView[] = page.map((r) => ({
      id: r.id,
      type: r.type,
      actor: r.actorId ? { id: r.actorId, name: names.get(r.actorId) ?? 'Unknown' } : null,
      payload: r.payload as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
  }

  /** Mirrors milestone decisions onto the latest deliverable version (called inside the milestone transaction). */
  static async mirrorDecision(
    tx: Parameters<Parameters<DbClient['db']['transaction']>[0]>[0],
    milestoneId: string,
    status: 'approved' | 'revision_requested',
  ) {
    const [latest] = await tx
      .select({ id: deliverables.id })
      .from(deliverables)
      .where(
        and(
          eq(deliverables.milestoneId, milestoneId),
          inArray(deliverables.status, ['submitted', 'revision_requested']),
        ),
      )
      .orderBy(desc(deliverables.version))
      .limit(1);
    if (latest) await tx.update(deliverables).set({ status }).where(eq(deliverables.id, latest.id));
  }
}
