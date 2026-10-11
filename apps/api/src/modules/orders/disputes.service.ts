import {
  and,
  asc,
  changeRequests,
  conversations,
  deliverableFeedback,
  deliverables,
  desc,
  disputeEvidence,
  disputes,
  eq,
  files,
  inArray,
  messages,
  milestones,
  profiles,
  projectEvents,
  projects,
  sql,
  type DbClient,
} from '@glasswork/db';
import { milestoneMachine, projectMachine, transition, type DisputeView } from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { recordChange } from './commerce.util';
import { ProjectsService } from './projects.service';

const OPENABLE = ['in_progress', 'submitted', 'revision_requested'] as const;
const clip = (s: string, n = 500) => (s.length > n ? `${s.slice(0, n)}…` : s);

@Injectable()
export class DisputesService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly projectsSvc: ProjectsService,
    private readonly access: AccessService,
    private readonly notifier: ProjectNotifier,
  ) {}

  /**
   * Either party opens a dispute on a FUNDED, unfinished milestone. The milestone and project freeze (auto-approve
   * timers stop because the milestone is no longer `submitted`) and an evidence snapshot is collected automatically.
   */
  async open(actor: RequestActor, milestoneId: string, reason: string) {
    const [m0] = await this.db.db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!m0) throw new NotFoundException('Milestone not found');
    const { role } = await this.projectsSvc.access(actor, m0.projectId);
    const id = await this.db.db
      .transaction(async (tx) => {
        const [m] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId)).for('update');
        const [p] = await tx.select().from(projects).where(eq(projects.id, m0.projectId)).for('update');
        if (!m || !p) throw new NotFoundException('Milestone not found');
        if (!(OPENABLE as readonly string[]).includes(m.status)) {
          throw new UnprocessableEntityException(
            `A dispute can be opened while work is in progress, submitted or in revision (milestone is ${m.status})`,
          );
        }
        if (p.status !== 'active') throw new UnprocessableEntityException(`The project is ${p.status}`);
        const nextM = transition(milestoneMachine, m.status, 'open_dispute', role);
        const nextP = transition(projectMachine, p.status, 'open_dispute', role);
        const caseFile = await this.buildCaseFile(
          tx as unknown as DbClient['db'],
          p,
          m,
          actor.userId,
          reason,
        );
        const [d] = await tx
          .insert(disputes)
          .values({ projectId: p.id, milestoneId, openedBy: actor.userId, reason, caseFile })
          .returning();
        await tx
          .update(milestones)
          .set({ status: nextM, autoApproveAt: null })
          .where(eq(milestones.id, milestoneId));
        await tx
          .update(projects)
          .set({ status: nextP, statusBeforeSide: p.status })
          .where(eq(projects.id, p.id));
        await recordChange(tx, {
          projectId: p.id,
          actorId: actor.userId,
          type: 'dispute.opened',
          entityType: 'dispute',
          entityId: d!.id,
          before: { milestone: m.status, project: p.status },
          after: { milestone: nextM, project: nextP },
          payload: { disputeId: d!.id, title: m.title },
        });
        return d!.id;
      })
      .catch((err: unknown) => {
        if ((err as { cause?: { code?: string } }).cause?.code === '23505') {
          throw new UnprocessableEntityException('This milestone already has an open dispute');
        }
        throw err;
      });
    await this.notifier.direct(
      m0.projectId,
      actor.userId,
      'dispute.opened',
      `A dispute was opened on “${m0.title}”`,
      reason.slice(0, 200),
    );
    return this.get(actor, id);
  }

  /** Snapshot of everything an admin needs, taken when the dispute is opened (messages, versions, approvals, scope changes). */
  private async buildCaseFile(
    db: DbClient['db'],
    p: typeof projects.$inferSelect,
    m: typeof milestones.$inferSelect,
    openedBy: string,
    reason: string,
  ) {
    const names = new Map(
      (
        await db
          .select({ id: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, [p.buyerId, p.sellerId]))
      ).map((n) => [n.id, n.name]),
    );
    const [conv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.projectId, p.id));
    const msgs = conv
      ? await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.id))
          .limit(100)
      : [];
    const dels = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.milestoneId, m.id))
      .orderBy(asc(deliverables.version));
    const fileRows = dels.length
      ? await db
          .select()
          .from(files)
          .where(
            inArray(
              files.id,
              dels.map((d) => d.fileId),
            ),
          )
      : [];
    const fb = dels.length
      ? await db
          .select({ deliverableId: deliverableFeedback.deliverableId, n: sql<number>`count(*)::int` })
          .from(deliverableFeedback)
          .where(
            inArray(
              deliverableFeedback.deliverableId,
              dels.map((d) => d.id),
            ),
          )
          .groupBy(deliverableFeedback.deliverableId)
      : [];
    const events = await db
      .select()
      .from(projectEvents)
      .where(eq(projectEvents.projectId, p.id))
      .orderBy(desc(projectEvents.id))
      .limit(100);
    const crs = await db.select().from(changeRequests).where(eq(changeRequests.projectId, p.id));
    return {
      generatedAt: new Date().toISOString(),
      reason,
      openedBy: { id: openedBy, name: names.get(openedBy) ?? 'Unknown' },
      project: {
        code: p.code,
        title: p.title,
        status: p.status,
        total: p.totalAmount,
        buyer: names.get(p.buyerId),
        seller: names.get(p.sellerId),
      },
      milestone: {
        title: m.title,
        amount: m.amount,
        status: m.status,
        acceptanceCriteria: m.acceptanceCriteria,
        plannedDue: m.plannedDue,
        submittedAt: m.actualSubmittedAt?.toISOString() ?? null,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        revisionCount: m.revisionCount,
        submissionNote: m.submissionNote,
        revisionNote: m.revisionNote,
      },
      deliverables: dels.map((d) => ({
        version: d.version,
        status: d.status,
        note: d.note,
        file: fileRows.find((f) => f.id === d.fileId)?.originalName ?? null,
        feedbackCount: fb.find((x) => x.deliverableId === d.id)?.n ?? 0,
        at: d.createdAt.toISOString(),
      })),
      messages: msgs.reverse().map((x) => ({
        at: x.createdAt.toISOString(),
        from: x.senderId ? (names.get(x.senderId) ?? 'Unknown') : 'System',
        kind: x.kind,
        body: clip(x.body),
      })),
      timeline: events.reverse().map((e) => ({ at: e.createdAt.toISOString(), type: e.type })),
      changeRequests: crs.map((c) => ({
        title: c.title,
        status: c.status,
        price: c.priceDeltaAmount,
        days: c.daysDelta,
      })),
    };
  }

  private async toView(rows: (typeof disputes.$inferSelect)[]): Promise<DisputeView[]> {
    if (!rows.length) return [];
    const ps = await this.db.db
      .select()
      .from(projects)
      .where(inArray(projects.id, [...new Set(rows.map((r) => r.projectId))]));
    const ms = await this.db.db
      .select()
      .from(milestones)
      .where(
        inArray(
          milestones.id,
          rows.map((r) => r.milestoneId),
        ),
      );
    const ev = await this.db.db
      .select()
      .from(disputeEvidence)
      .where(
        inArray(
          disputeEvidence.disputeId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(disputeEvidence.id));
    const fileRows = ev.some((e) => e.fileId)
      ? await this.db.db
          .select()
          .from(files)
          .where(
            inArray(
              files.id,
              ev.map((e) => e.fileId).filter((x): x is string => Boolean(x)),
            ),
          )
      : [];
    const people = await this.db.db
      .select({ id: profiles.userId, name: profiles.displayName })
      .from(profiles);
    const nm = (id: string | null) => ({ id, name: people.find((x) => x.id === id)?.name ?? 'Unknown' });
    return rows.map((d) => {
      const p = ps.find((x) => x.id === d.projectId)!;
      const m = ms.find((x) => x.id === d.milestoneId)!;
      return {
        id: d.id,
        projectId: d.projectId,
        projectCode: p.code,
        projectTitle: p.title,
        milestoneId: d.milestoneId,
        milestoneTitle: m.title,
        milestoneAmount: m.amount,
        currency: m.currency,
        status: d.status,
        outcome: d.outcome,
        refundAmount: d.refundAmount,
        reason: d.reason,
        resolutionNote: d.resolutionNote,
        openedBy: { id: d.openedBy, name: nm(d.openedBy).name },
        createdAt: d.createdAt.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        caseFile: d.caseFile as Record<string, unknown>,
        evidence: ev
          .filter((e) => e.disputeId === d.id)
          .map((e) => ({
            id: e.id,
            kind: e.kind,
            by: nm(e.submittedBy),
            note: e.note,
            refId: e.refId,
            file: e.fileId
              ? { id: e.fileId, name: fileRows.find((f) => f.id === e.fileId)?.originalName ?? 'file' }
              : null,
            createdAt: e.createdAt.toISOString(),
          })),
      };
    });
  }

  async get(actor: RequestActor, disputeId: string) {
    const [d] = await this.db.db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!d || !(await this.access.projectRole(actor.userId, d.projectId)))
      throw new NotFoundException('Dispute not found');
    return (await this.toView([d]))[0]!;
  }

  async forProject(actor: RequestActor, projectId: string) {
    await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(disputes)
      .where(eq(disputes.projectId, projectId))
      .orderBy(desc(disputes.id));
    return this.toView(rows);
  }

  async addEvidence(
    actor: RequestActor,
    disputeId: string,
    input: {
      kind: 'note' | 'upload' | 'message' | 'deliverable';
      note?: string;
      fileId?: string;
      refId?: string;
    },
  ) {
    const [d] = await this.db.db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!d || !(await this.access.projectRole(actor.userId, d.projectId)))
      throw new NotFoundException('Dispute not found');
    if (d.status === 'resolved') throw new UnprocessableEntityException('This dispute is resolved');
    if (input.fileId) {
      const [f] = await this.db.db
        .select()
        .from(files)
        .where(and(eq(files.id, input.fileId), eq(files.ownerId, actor.userId)));
      if (!f) throw new NotFoundException('File not found');
      if (f.purpose !== 'evidence' || f.status !== 'clean')
        throw new UnprocessableEntityException('Evidence files must be completed, scanned evidence uploads');
    }
    if (input.refId && input.kind === 'deliverable') {
      const [x] = await this.db.db
        .select({ id: deliverables.id })
        .from(deliverables)
        .where(and(eq(deliverables.id, input.refId), eq(deliverables.projectId, d.projectId)));
      if (!x) throw new NotFoundException('Deliverable not found');
    }
    if (input.refId && input.kind === 'message') {
      const [x] = await this.db.db
        .select({ id: messages.id })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(and(eq(messages.id, input.refId), eq(conversations.projectId, d.projectId)));
      if (!x) throw new NotFoundException('Message not found');
    }
    await this.db.db.transaction(async (tx) => {
      const [e] = await tx
        .insert(disputeEvidence)
        .values({
          disputeId,
          submittedBy: actor.userId,
          kind: input.kind,
          note: input.note ?? null,
          fileId: input.fileId ?? null,
          refId: input.refId ?? null,
        })
        .returning();
      await recordChange(tx, {
        projectId: d.projectId,
        actorId: actor.userId,
        type: 'dispute.evidence',
        entityType: 'dispute_evidence',
        entityId: e!.id,
        payload: { disputeId, kind: input.kind },
      });
    });
    return this.get(actor, disputeId);
  }

  // ---- admin ----------------------------------------------------------------------------------------

  async adminList(status: 'open' | 'under_review' | 'resolved') {
    const rows = await this.db.db
      .select()
      .from(disputes)
      .where(
        status === 'open' ? sql`${disputes.status} in ('open', 'under_review')` : eq(disputes.status, status),
      )
      .orderBy(desc(disputes.id))
      .limit(100);
    const views = await this.toView(rows);
    return views.map(({ caseFile: _c, evidence: _e, ...rest }) => rest);
  }

  async adminGet(disputeId: string) {
    const [d] = await this.db.db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!d) throw new NotFoundException('Dispute not found');
    return (await this.toView([d]))[0]!;
  }

  async startReview(admin: RequestActor, disputeId: string) {
    const upd = await this.db.db
      .update(disputes)
      .set({ status: 'under_review' })
      .where(and(eq(disputes.id, disputeId), eq(disputes.status, 'open')))
      .returning({ id: disputes.id, projectId: disputes.projectId });
    if (!upd.length) throw new UnprocessableEntityException('Only an open dispute can be taken under review');
    await this.notifier.direct(
      upd[0]!.projectId,
      admin.userId,
      'dispute.opened',
      'An administrator is reviewing the dispute',
    );
    return this.adminGet(disputeId);
  }
}
