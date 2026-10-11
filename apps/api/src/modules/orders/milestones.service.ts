import {
  and,
  asc,
  eq,
  disputes,
  escrowHolds,
  milestones,
  payments,
  profiles,
  projects,
  sql,
  transfers,
  users,
  type DbClient,
  type DbTx,
} from '@glasswork/db';
import {
  milestoneMachine,
  projectMachine,
  transition,
  type Actor,
  type DisputeOutcome,
  type MilestoneJob,
} from '@glasswork/shared';
import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { ENV, type ApiEnv } from '../../config/env';
import type { EmailQueue, MilestoneQueue } from '../../infra/infra.module';
import { DB, EMAIL_QUEUE, MILESTONE_QUEUE } from '../../infra/tokens';
import { FeesService } from '../payments/fees.service';
import { accounts, LedgerService } from '../payments/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { RoomService } from '../room/room.service';
import { recordChange } from './commerce.util';
import { ProjectsService } from './projects.service';

const DAY_MS = 86_400_000;

type Locked = {
  m: typeof milestones.$inferSelect;
  p: typeof projects.$inferSelect;
};

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(MILESTONE_QUEUE) private readonly queue: MilestoneQueue,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: EmailQueue,
    private readonly projectsSvc: ProjectsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly fees: FeesService,
    private readonly notifier: ProjectNotifier,
  ) {}

  // ---- project-level: accept / decline -------------------------------------------

  /** Seller accepts the order once the first milestone is funded (STATE_MACHINE.md §1). */
  async acceptProject(actor: RequestActor, projectId: string) {
    const { role } = await this.projectsSvc.access(actor, projectId);
    if (role !== 'seller') throw new NotFoundException('Project not found'); // buyers can't accept their own order
    await this.db.db.transaction(async (tx) => {
      const [p] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
      if (!p) throw new NotFoundException('Project not found');
      const [first] = await tx
        .select()
        .from(milestones)
        .where(and(eq(milestones.projectId, projectId), eq(milestones.position, 1)));
      if (first?.status !== 'funded') {
        throw new UnprocessableEntityException(
          'The buyer must fund the first milestone before you can accept',
        );
      }
      const next = this.guard(() => transition(projectMachine, p.status, 'accept', 'seller'));
      await tx
        .update(projects)
        .set({ status: next, startedAt: new Date() })
        .where(eq(projects.id, projectId));
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: 'project.accepted',
        entityType: 'project',
        entityId: projectId,
        before: { status: p.status },
        after: { status: next },
      });
    });
    await this.notifier.event(projectId, actor.userId, 'project.accepted');
    return this.projectsSvc.view(actor, projectId);
  }

  /** Seller declines or buyer withdraws before work starts; every funded milestone is refunded in full. */
  async declineProject(actor: RequestActor, projectId: string, reason: string) {
    const { role, project } = await this.projectsSvc.access(actor, projectId);
    if (project.status !== 'requirements_submitted') {
      throw new UnprocessableEntityException(
        'Only an order awaiting acceptance can be declined or withdrawn',
      );
    }
    this.guard(() => transition(projectMachine, project.status, 'decline', role));

    // Provider refunds first (idempotent per payment); the books are updated afterwards in one transaction.
    const funded = await this.fundedPayments(projectId);
    for (const f of funded) await this.payments.providerRefund(f.payment);

    await this.db.db.transaction(async (tx) => {
      const [p] = await tx.select().from(projects).where(eq(projects.id, projectId)).for('update');
      if (!p || p.status !== 'requirements_submitted')
        throw new UnprocessableEntityException('Project changed; retry');
      const ms = await tx.select().from(milestones).where(eq(milestones.projectId, projectId)).for('update');
      for (const m of ms) {
        if (m.status === 'funded') await this.refundTx(tx, m, p, actor.userId, 'system', 'declined');
        else if (m.status === 'pending') {
          await tx
            .update(milestones)
            .set({ status: this.guard(() => transition(milestoneMachine, m.status, 'cancel', role)) })
            .where(eq(milestones.id, m.id));
          await tx
            .update(payments)
            .set({ status: 'failed', failureReason: 'order cancelled' })
            .where(and(eq(payments.milestoneId, m.id), eq(payments.status, 'pending')));
        }
      }
      await tx.update(projects).set({ status: 'cancelled' }).where(eq(projects.id, projectId));
      await recordChange(tx, {
        projectId,
        actorId: actor.userId,
        type: role === 'seller' ? 'project.declined' : 'project.withdrawn',
        entityType: 'project',
        entityId: projectId,
        before: { status: p.status },
        after: { status: 'cancelled', reason },
        payload: { reason },
      });
    });
    await this.notifier.event(
      projectId,
      actor.userId,
      role === 'seller' ? 'project.declined' : 'project.withdrawn',
    );
    return this.projectsSvc.view(actor, projectId);
  }

  // ---- milestone workflow ------------------------------------------------------------

  async start(actor: RequestActor, milestoneId: string) {
    const projectId = await this.mutate(actor, milestoneId, 'seller', async (tx, { m, p }) => {
      this.requireActive(p);
      const next = this.guard(() => transition(milestoneMachine, m.status, 'start', 'seller'));
      await tx.update(milestones).set({ status: next }).where(eq(milestones.id, m.id));
      await recordChange(tx, {
        projectId: p.id,
        actorId: actor.userId,
        type: 'milestone.started',
        entityType: 'milestone',
        entityId: m.id,
        before: { status: m.status },
        after: { status: next },
        payload: { milestoneId: m.id, title: m.title },
      });
    });
    this.notifier.changed(projectId, 'milestone.started');
    return this.projectsSvc.view(actor, projectId);
  }

  async submit(actor: RequestActor, milestoneId: string, note?: string) {
    let scheduled: { id: string; at: Date } | undefined;
    const projectId = await this.mutate(actor, milestoneId, 'seller', async (tx, { m, p }) => {
      this.requireActive(p);
      const next = this.guard(() => transition(milestoneMachine, m.status, 'submit', 'seller'));
      const days = await this.fees.autoApproveDays(tx);
      const autoApproveAt = new Date(Date.now() + days * DAY_MS);
      await tx
        .update(milestones)
        .set({ status: next, actualSubmittedAt: new Date(), autoApproveAt, submissionNote: note ?? null })
        .where(eq(milestones.id, m.id));
      await recordChange(tx, {
        projectId: p.id,
        actorId: actor.userId,
        type: 'milestone.submitted',
        entityType: 'milestone',
        entityId: m.id,
        before: { status: m.status },
        after: { status: next, autoApproveAt: autoApproveAt.toISOString() },
        payload: { milestoneId: m.id, title: m.title, autoApproveAt: autoApproveAt.toISOString() },
      });
      scheduled = { id: m.id, at: autoApproveAt };
    });
    if (scheduled) await this.scheduleTimers(scheduled.id, scheduled.at);
    await this.notifier.event(projectId, actor.userId, 'milestone.submitted', milestoneId);
    return this.projectsSvc.view(actor, projectId);
  }

  async requestRevision(actor: RequestActor, milestoneId: string, note: string) {
    const projectId = await this.mutate(actor, milestoneId, 'buyer', async (tx, { m, p }) => {
      this.requireActive(p);
      const next = this.guard(() => transition(milestoneMachine, m.status, 'request_revision', 'buyer'));
      await tx
        .update(milestones)
        .set({ status: next, revisionCount: m.revisionCount + 1, revisionNote: note, autoApproveAt: null })
        .where(eq(milestones.id, m.id));
      await recordChange(tx, {
        projectId: p.id,
        actorId: actor.userId,
        type: 'milestone.revision_requested',
        entityType: 'milestone',
        entityId: m.id,
        before: { status: m.status },
        after: { status: next },
        payload: { milestoneId: m.id, title: m.title, note },
      });
      await RoomService.mirrorDecision(tx, m.id, 'revision_requested');
    });
    await this.notifier.event(projectId, actor.userId, 'milestone.revision_requested', milestoneId);
    return this.projectsSvc.view(actor, projectId);
  }

  /** Buyer approves → the milestone is released to the seller's balance in the same transaction. */
  async approve(actor: RequestActor, milestoneId: string) {
    const projectId = await this.mutate(actor, milestoneId, 'buyer', async (tx, locked) => {
      this.requireActive(locked.p);
      const next = this.guard(() => transition(milestoneMachine, locked.m.status, 'approve', 'buyer'));
      await tx
        .update(milestones)
        .set({ status: next, approvedAt: new Date() })
        .where(eq(milestones.id, locked.m.id));
      await recordChange(tx, {
        projectId: locked.p.id,
        actorId: actor.userId,
        type: 'milestone.approved',
        entityType: 'milestone',
        entityId: locked.m.id,
        before: { status: locked.m.status },
        after: { status: next },
        payload: { milestoneId: locked.m.id, title: locked.m.title },
      });
      await RoomService.mirrorDecision(tx, locked.m.id, 'approved');
      await this.releaseTx(tx, { ...locked, m: { ...locked.m, status: next } }, actor.userId);
    });
    await this.notifier.event(projectId, actor.userId, 'milestone.released', milestoneId);
    return this.projectsSvc.view(actor, projectId);
  }

  // ---- timers (called by the worker through the internal controller) ------------------

  /** Idempotent. Skips unless the milestone is still `submitted`, due, and the project is active (timer frozen while paused). */
  async autoApprove(milestoneId: string): Promise<{ result: 'approved' | 'skipped'; reason?: string }> {
    let projectId: string | undefined;
    const out = await this.db.db.transaction(async (tx) => {
      const locked = await this.lock(tx, milestoneId);
      if (!locked) return { result: 'skipped' as const, reason: 'not found' };
      const { m, p } = locked;
      if (m.status !== 'submitted' || !m.autoApproveAt)
        return { result: 'skipped' as const, reason: 'not awaiting approval' };
      if (m.autoApproveAt.getTime() > Date.now())
        return { result: 'skipped' as const, reason: 'not due yet' };
      if (p.status !== 'active') return { result: 'skipped' as const, reason: `project is ${p.status}` };
      const next = transition(milestoneMachine, m.status, 'auto_approve', 'system');
      await tx
        .update(milestones)
        .set({ status: next, approvedAt: new Date() })
        .where(eq(milestones.id, m.id));
      await recordChange(tx, {
        projectId: p.id,
        actorId: null,
        type: 'milestone.auto_approved',
        entityType: 'milestone',
        entityId: m.id,
        before: { status: m.status },
        after: { status: next },
        payload: { milestoneId: m.id, title: m.title },
      });
      await RoomService.mirrorDecision(tx, m.id, 'approved');
      await this.releaseTx(tx, { m: { ...m, status: next }, p }, null);
      projectId = p.id;
      return { result: 'approved' as const };
    });
    if (projectId) await this.notifier.event(projectId, null, 'milestone.released', milestoneId);
    return out;
  }

  /** Reminder email to the buyer while a submitted milestone is still waiting (days 2 and 4). */
  async remind(milestoneId: string): Promise<{ sent: boolean }> {
    const [row] = await this.db.db
      .select()
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(eq(milestones.id, milestoneId));
    if (
      !row ||
      row.milestones.status !== 'submitted' ||
      !row.milestones.autoApproveAt ||
      row.projects.status !== 'active'
    ) {
      return { sent: false };
    }
    const [buyer] = await this.db.db
      .select({ email: users.email, name: profiles.displayName })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, row.projects.buyerId));
    if (!buyer) return { sent: false };
    const daysLeft = Math.max(0, Math.ceil((row.milestones.autoApproveAt.getTime() - Date.now()) / DAY_MS));
    await this.emailQueue.add(
      'milestone-reminder',
      {
        template: 'milestone-reminder',
        to: buyer.email,
        data: {
          name: buyer.name,
          projectTitle: row.projects.title,
          milestoneTitle: row.milestones.title,
          daysLeft,
          url: `${this.env.WEB_URL}/projects/${row.projects.id}`,
        },
      },
      { jobId: `reminder-mail:${milestoneId}:${daysLeft}` },
    );
    return { sent: true };
  }

  private async scheduleTimers(milestoneId: string, autoApproveAt: Date) {
    const stamp = autoApproveAt.getTime();
    const jobs: { name: string; data: MilestoneJob; at: number; id: string }[] = [
      {
        name: 'auto-approve',
        data: { kind: 'auto-approve', milestoneId },
        at: stamp,
        id: `auto-${milestoneId}-${stamp}`,
      },
      // Reminders 3 and 1 days before auto-approval (= days 2 and 4 with the default 5-day window).
      ...[3, 1].map((d) => ({
        name: 'reminder',
        data: { kind: 'reminder' as const, milestoneId },
        at: stamp - d * DAY_MS,
        id: `remind-${milestoneId}-${stamp}-${d}`,
      })),
    ];
    for (const j of jobs) {
      const delay = j.at - Date.now();
      if (delay <= 0) continue;
      await this.queue.add(j.name, j.data, { delay, jobId: j.id });
    }
  }

  // ---- refunds (admin) -----------------------------------------------------------------

  /** Operations admin refunds a funded milestone in full (disputes with partial outcomes arrive in Phase 5). */
  async adminRefund(admin: RequestActor, milestoneId: string, reason: string) {
    const [pay] = await this.db.db
      .select({ payment: payments })
      .from(payments)
      .where(and(eq(payments.milestoneId, milestoneId), eq(payments.status, 'succeeded')));
    if (!pay)
      throw new UnprocessableEntityException(
        'Only a funded milestone with a successful payment can be refunded',
      );
    await this.payments.providerRefund(pay.payment);
    await this.db.db.transaction(async (tx) => {
      const locked = await this.lock(tx, milestoneId);
      if (!locked) throw new NotFoundException('Milestone not found');
      if (locked.m.status !== 'funded') {
        throw new UnprocessableEntityException(`A ${locked.m.status} milestone cannot be refunded here`);
      }
      await this.refundTx(tx, locked.m, locked.p, admin.userId, 'admin', reason);
    });
    return { ok: true };
  }

  // ---- dispute resolution (admin) ----------------------------------------------------------------

  /**
   * Operations resolves a dispute over a funded milestone: release to the seller, refund the buyer in full, or
   * split. Money moves inside one transaction with the ledger; the provider refund is idempotent and happens first.
   * On a split the buyer's service fee is kept (the platform did provide the service) and the seller commission is
   * pro-rated to what the seller actually receives.
   */
  async resolveDispute(
    admin: RequestActor,
    disputeId: string,
    input: { outcome: DisputeOutcome; refundAmount?: number; note: string },
  ) {
    const [d] = await this.db.db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!d) throw new NotFoundException('Dispute not found');
    if (d.status === 'resolved') throw new UnprocessableEntityException('This dispute is already resolved');
    const [pay] = await this.db.db
      .select()
      .from(payments)
      .where(and(eq(payments.milestoneId, d.milestoneId), eq(payments.status, 'succeeded')));
    if (!pay) throw new UnprocessableEntityException('There are no held funds to resolve');
    let refund = 0;
    if (input.outcome === 'split') {
      refund = input.refundAmount ?? 0;
      if (!Number.isInteger(refund) || refund < 1 || refund >= pay.amount) {
        throw new UnprocessableEntityException(
          'A split needs a refund between 1 and the milestone amount minus 1',
        );
      }
    } else if (input.refundAmount !== undefined) {
      throw new UnprocessableEntityException('refundAmount is only used for a split');
    }
    if (input.outcome === 'refund') await this.payments.providerRefund(pay);
    if (input.outcome === 'split') await this.payments.providerRefund(pay, refund);

    const result = await this.db.db.transaction(async (tx) => {
      const [dd] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).for('update');
      if (!dd || dd.status === 'resolved')
        throw new UnprocessableEntityException('This dispute is already resolved');
      const locked = await this.lock(tx, dd.milestoneId);
      if (!locked) throw new NotFoundException('Milestone not found');
      const { m, p } = locked;
      if (m.status !== 'disputed')
        throw new UnprocessableEntityException(`The milestone is ${m.status}, not disputed`);

      if (input.outcome === 'release') {
        await this.releaseTx(tx, locked, admin.userId, 'resolve_release', 'admin');
      } else if (input.outcome === 'refund') {
        await this.refundTx(tx, m, p, admin.userId, 'admin', input.note, 'resolve_refund');
      } else {
        await this.splitTx(tx, locked, admin.userId, refund, input.note);
      }
      await tx
        .update(disputes)
        .set({
          status: 'resolved',
          outcome: input.outcome,
          refundAmount: input.outcome === 'split' ? refund : input.outcome === 'refund' ? pay.amount : null,
          resolutionNote: input.note,
          resolvedBy: admin.userId,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId));

      // The project leaves "disputed" only when its last open dispute is closed.
      const others = await tx
        .select({ id: disputes.id })
        .from(disputes)
        .where(
          and(
            eq(disputes.projectId, p.id),
            sql`${disputes.status} <> 'resolved'`,
            sql`${disputes.id} <> ${disputeId}`,
          ),
        );
      let projectStatus = p.status;
      if (others.length === 0 && p.status === 'disputed') {
        transition(projectMachine, p.status, 'resolve_dispute', 'admin');
        const rest = await tx
          .select({ status: milestones.status })
          .from(milestones)
          .where(eq(milestones.projectId, p.id));
        const remaining = rest.some((x) => !['released', 'cancelled', 'refunded'].includes(x.status));
        const anyPaid = rest.some((x) => x.status === 'released');
        if (remaining) {
          projectStatus = transition(projectMachine, 'resolved', 'resume_after_resolution', 'system');
          await tx
            .update(projects)
            .set({ status: projectStatus, statusBeforeSide: null })
            .where(eq(projects.id, p.id));
        } else if (anyPaid) {
          projectStatus = transition(projectMachine, 'resolved', 'complete_after_resolution', 'system');
          await tx
            .update(projects)
            .set({ status: projectStatus, completedAt: new Date(), statusBeforeSide: null })
            .where(eq(projects.id, p.id));
        } else {
          projectStatus = transition(projectMachine, 'resolved', 'cancel_after_resolution', 'system');
          await tx
            .update(projects)
            .set({ status: projectStatus, statusBeforeSide: null })
            .where(eq(projects.id, p.id));
        }
      }
      await recordChange(tx, {
        projectId: p.id,
        actorId: admin.userId,
        type: 'dispute.resolved',
        entityType: 'dispute',
        entityId: disputeId,
        before: { status: dd.status },
        after: { status: 'resolved', outcome: input.outcome, refund, projectStatus },
        payload: { disputeId, outcome: input.outcome, refund, title: m.title },
      });
      return { projectId: p.id, milestoneId: m.id };
    });
    await this.notifier.direct(
      result.projectId,
      admin.userId,
      'dispute.resolved',
      `The dispute was resolved (${input.outcome})`,
      input.note.slice(0, 200),
    );
    return { id: disputeId, outcome: input.outcome, projectId: result.projectId };
  }

  /** Splits a disputed milestone's escrow: `refund` back to the buyer, the rest to the seller (commission pro-rated). */
  private async splitTx(tx: DbTx, { m, p }: Locked, actorId: string, refund: number, note: string) {
    const [hold] = await tx
      .select()
      .from(escrowHolds)
      .where(and(eq(escrowHolds.milestoneId, m.id), eq(escrowHolds.status, 'held')))
      .for('update');
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.milestoneId, m.id), eq(payments.status, 'succeeded')))
      .for('update');
    if (!hold || !pay) throw new UnprocessableEntityException('Nothing to split for this milestone');
    const next = this.guard(() => transition(milestoneMachine, m.status, 'resolve_split', 'admin'));
    const toSeller = hold.amount - refund;
    const commission = Math.round((hold.sellerCommissionAmount * toSeller) / hold.amount);
    const net = toSeller - commission;
    await tx.update(milestones).set({ status: next }).where(eq(milestones.id, m.id));
    await tx
      .update(escrowHolds)
      .set({ status: 'split', releasedAt: new Date() })
      .where(eq(escrowHolds.id, hold.id));
    await tx.update(payments).set({ status: 'partially_refunded' }).where(eq(payments.id, pay.id));
    await tx.insert(transfers).values({
      escrowHoldId: hold.id,
      sellerId: p.sellerId,
      grossAmount: toSeller,
      sellerFeeAmount: commission,
      netAmount: net,
      currency: m.currency,
    });
    await this.ledger.post(tx, {
      kind: 'dispute_split',
      referenceType: 'milestone',
      referenceId: m.id,
      idempotencyKey: `split:${m.id}`,
      currency: m.currency,
      description: `Dispute split: ${p.code} · ${m.title}`,
      lines: [
        { account: accounts.escrow(m.id), amount: hold.amount },
        { account: accounts.cash(), amount: -refund },
        ...(net > 0 ? [{ account: accounts.sellerPayable(p.sellerId), amount: -net }] : []),
        ...(commission > 0 ? [{ account: accounts.revenue(), amount: -commission }] : []),
      ],
    });
    await recordChange(tx, {
      projectId: p.id,
      actorId,
      type: 'milestone.released',
      entityType: 'milestone',
      entityId: m.id,
      before: { status: m.status },
      after: { status: next, split: true, refundToBuyer: refund, toSeller, commission, net, note },
      payload: { milestoneId: m.id, title: m.title, net, split: true },
    });
  }

  // ---- internals ----------------------------------------------------------------------

  private guard<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      throw new UnprocessableEntityException(err instanceof Error ? err.message : 'Invalid state transition');
    }
  }

  private requireActive(p: { status: string }) {
    if (p.status !== 'active')
      throw new UnprocessableEntityException(`The project is ${p.status}, not active`);
  }

  private async lock(tx: DbTx, milestoneId: string): Promise<Locked | null> {
    const [m] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId)).for('update');
    if (!m) return null;
    const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId)).for('update');
    return p ? { m, p } : null;
  }

  /** Participant + role check, then runs `fn` inside a transaction with the milestone and project locked. */
  private async mutate(
    actor: RequestActor,
    milestoneId: string,
    requiredRole: 'buyer' | 'seller',
    fn: (tx: DbTx, locked: Locked) => Promise<void>,
  ): Promise<string> {
    const [row] = await this.db.db
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, milestoneId));
    if (!row) throw new NotFoundException('Milestone not found');
    const { role } = await this.projectsSvc.access(actor, row.projectId); // 404 for non-participants
    if (role !== requiredRole) {
      throw new UnprocessableEntityException(`Only the ${requiredRole} can do this`);
    }
    await this.db.db.transaction(async (tx) => {
      const locked = await this.lock(tx, milestoneId);
      if (!locked) throw new NotFoundException('Milestone not found');
      await fn(tx, locked);
    });
    return row.projectId;
  }

  private async fundedPayments(projectId: string) {
    return this.db.db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(milestones, eq(milestones.id, payments.milestoneId))
      .innerJoin(escrowHolds, and(eq(escrowHolds.milestoneId, milestones.id), eq(escrowHolds.status, 'held')))
      .where(
        and(
          eq(milestones.projectId, projectId),
          eq(payments.status, 'succeeded'),
          eq(milestones.status, 'funded'),
        ),
      );
  }

  /** Books a full refund of a funded milestone (ledger reversal, statuses). The provider refund already happened. */
  private async refundTx(
    tx: DbTx,
    m: typeof milestones.$inferSelect,
    p: typeof projects.$inferSelect,
    actorId: string,
    actor: Actor,
    reason: string,
    event: 'refund' | 'resolve_refund' = 'refund',
  ) {
    const [hold] = await tx
      .select()
      .from(escrowHolds)
      .where(and(eq(escrowHolds.milestoneId, m.id), eq(escrowHolds.status, 'held')))
      .for('update');
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.milestoneId, m.id), eq(payments.status, 'succeeded')))
      .for('update');
    if (!hold || !pay) throw new UnprocessableEntityException('Nothing to refund for this milestone');
    const next = this.guard(() => transition(milestoneMachine, m.status, event, actor));
    await tx.update(milestones).set({ status: next }).where(eq(milestones.id, m.id));
    await tx
      .update(escrowHolds)
      .set({ status: 'refunded', releasedAt: new Date() })
      .where(eq(escrowHolds.id, hold.id));
    await tx.update(payments).set({ status: 'refunded' }).where(eq(payments.id, pay.id));
    await this.ledger.post(tx, {
      kind: 'refund',
      referenceType: 'payment',
      referenceId: pay.id,
      idempotencyKey: `refund:${pay.id}`,
      currency: m.currency,
      description: `Refund: ${p.code} · ${m.title}`,
      lines: [
        { account: accounts.escrow(m.id), amount: pay.amount },
        ...(pay.buyerFeeAmount > 0 ? [{ account: accounts.revenue(), amount: pay.buyerFeeAmount }] : []),
        { account: accounts.cash(), amount: -(pay.amount + pay.buyerFeeAmount) },
      ],
    });
    await recordChange(tx, {
      projectId: p.id,
      actorId,
      type: 'milestone.refunded',
      entityType: 'milestone',
      entityId: m.id,
      before: { status: m.status },
      after: { status: next, refunded: pay.amount + pay.buyerFeeAmount, reason },
      payload: { milestoneId: m.id, title: m.title, reason },
    });
  }

  /** approved → released: moves escrow to the seller's payable balance (minus the commission fixed at funding). */
  private async releaseTx(
    tx: DbTx,
    { m, p }: Locked,
    actorId: string | null,
    event: 'release' | 'resolve_release' = 'release',
    actor: Actor = 'system',
  ) {
    const [hold] = await tx.select().from(escrowHolds).where(eq(escrowHolds.milestoneId, m.id)).for('update');
    if (!hold || hold.status !== 'held')
      throw new UnprocessableEntityException('No held funds to release for this milestone');
    const next = transition(milestoneMachine, m.status, event, actor);
    const net = hold.amount - hold.sellerCommissionAmount;
    await tx.update(milestones).set({ status: next }).where(eq(milestones.id, m.id));
    await tx
      .update(escrowHolds)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(escrowHolds.id, hold.id));
    await tx.insert(transfers).values({
      escrowHoldId: hold.id,
      sellerId: p.sellerId,
      grossAmount: hold.amount,
      sellerFeeAmount: hold.sellerCommissionAmount,
      netAmount: net,
      currency: m.currency,
    });
    await this.ledger.post(tx, {
      kind: 'release',
      referenceType: 'milestone',
      referenceId: m.id,
      idempotencyKey: `release:${m.id}`,
      currency: m.currency,
      description: `Released: ${p.code} · ${m.title}`,
      lines: [
        { account: accounts.escrow(m.id), amount: hold.amount },
        ...(net > 0 ? [{ account: accounts.sellerPayable(p.sellerId), amount: -net }] : []),
        ...(hold.sellerCommissionAmount > 0
          ? [{ account: accounts.revenue(), amount: -hold.sellerCommissionAmount }]
          : []),
      ],
    });
    await recordChange(tx, {
      projectId: p.id,
      actorId,
      type: 'milestone.released',
      entityType: 'milestone',
      entityId: m.id,
      before: { status: m.status },
      after: { status: next, gross: hold.amount, commission: hold.sellerCommissionAmount, net },
      payload: { milestoneId: m.id, title: m.title, net },
    });

    // Project completes when nothing is left to deliver.
    const all = await tx
      .select({ status: milestones.status })
      .from(milestones)
      .where(eq(milestones.projectId, p.id))
      .orderBy(asc(milestones.position));
    const open = all.filter((x) => !['released', 'cancelled', 'refunded'].includes(x.status));
    if (open.length === 0 && p.status === 'active') {
      const done = transition(projectMachine, p.status, 'complete', 'system');
      await tx.update(projects).set({ status: done, completedAt: new Date() }).where(eq(projects.id, p.id));
      await recordChange(tx, {
        projectId: p.id,
        actorId: null,
        type: 'project.completed',
        entityType: 'project',
        entityId: p.id,
        before: { status: p.status },
        after: { status: done },
      });
    }
  }
}
