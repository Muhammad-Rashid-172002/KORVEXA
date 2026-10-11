import {
  and,
  auditLogs,
  desc,
  eq,
  escrowHolds,
  invoices,
  milestones,
  payments,
  projectEvents,
  projects,
  users,
  webhookEvents,
  type DbClient,
  type DbTx,
} from '@glasswork/db';
import { milestoneMachine as milestoneMachineRef, transition, type FeeQuote } from '@glasswork/shared';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../auth/session.service';
import { ENV, type ApiEnv } from '../../config/env';
import { DB } from '../../infra/tokens';
import { FeesService } from './fees.service';
import { accounts, LedgerService } from './ledger.service';
import { InvalidWebhookSignatureError, PaymentsProvider, type ParsedEvent } from './payments.provider';
import { TestPaymentsProvider } from './test-payments.provider';
import { ProjectNotifier } from '../notifications/project-notifier.service';

export interface FundingResult {
  paymentId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  checkoutUrl: string | null;
  provider: string;
  quote: FeeQuote;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly provider: PaymentsProvider,
    private readonly ledger: LedgerService,
    private readonly fees: FeesService,
    private readonly notifier: ProjectNotifier,
  ) {}

  // ---- money in: start a checkout ------------------------------------------------

  /** Buyer starts funding one milestone. The amount is ALWAYS recomputed here from the DB (brief §11). */
  async startFunding(
    actor: RequestActor,
    milestoneId: string,
    idempotencyKey: string,
  ): Promise<FundingResult> {
    const [row] = await this.db.db
      .select({ m: milestones, p: projects })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(eq(milestones.id, milestoneId), eq(projects.buyerId, actor.userId)));
    // Not the buyer of this project → looks nonexistent (D-011).
    if (!row) throw new NotFoundException('Milestone not found');
    const { m, p } = row;

    if (m.status !== 'pending')
      throw new UnprocessableEntityException(`A ${m.status} milestone cannot be funded`);
    if (p.status !== 'requirements_submitted' && p.status !== 'active') {
      throw new UnprocessableEntityException(`Milestones cannot be funded while the project is ${p.status}`);
    }
    if (m.position > 1 && p.status !== 'active') {
      throw new UnprocessableEntityException(
        'The seller must accept the project before later milestones are funded',
      );
    }

    const quote = await this.fees.quote(m.amount);
    const [open] = await this.db.db
      .select()
      .from(payments)
      .where(and(eq(payments.milestoneId, m.id), eq(payments.status, 'pending')));
    if (open) {
      // Re-opening an unfinished checkout (e.g. the tab was closed) never creates a second charge.
      return {
        paymentId: open.id,
        status: open.status,
        checkoutUrl: open.checkoutUrl,
        provider: open.provider,
        quote,
      };
    }

    const [buyer] = await this.db.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, actor.userId));
    const paymentId = randomUUID();
    const [pay] = await this.db.db
      .insert(payments)
      .values({
        id: paymentId,
        milestoneId: m.id,
        payerId: actor.userId,
        amount: m.amount,
        buyerFeeAmount: quote.buyerFee,
        currency: m.currency,
        provider: this.provider.name,
        idempotencyKey: `${actor.userId}:${idempotencyKey}`,
      })
      .returning();
    if (!pay) throw new Error('insert failed');

    try {
      const session = await this.provider.createCheckout({
        paymentId,
        amount: quote.buyerTotal,
        currency: m.currency,
        description: `${p.code} · ${m.title}`,
        customerEmail: buyer?.email ?? '',
        successUrl: `${this.env.WEB_URL}/projects/${p.id}?paid=${paymentId}`,
        cancelUrl: `${this.env.WEB_URL}/projects/${p.id}`,
        idempotencyKey: pay.idempotencyKey,
      });
      await this.db.db
        .update(payments)
        .set({ providerRef: session.providerRef, checkoutUrl: session.url })
        .where(eq(payments.id, paymentId));
      await this.db.db.insert(projectEvents).values({
        projectId: p.id,
        actorId: actor.userId,
        type: 'payment.started',
        payload: { milestoneId: m.id, paymentId, amount: quote.buyerTotal },
      });
      return { paymentId, status: 'pending', checkoutUrl: session.url, provider: this.provider.name, quote };
    } catch (err) {
      await this.db.db
        .update(payments)
        .set({ status: 'failed', failureReason: 'checkout creation failed' })
        .where(eq(payments.id, paymentId));
      this.logger.error({ err, paymentId }, 'checkout creation failed');
      throw new BadGatewayException('The payment provider is unavailable. Nothing was charged.');
    }
  }

  async getPayment(actor: RequestActor, paymentId: string) {
    const [pay] = await this.db.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.payerId, actor.userId)));
    if (!pay) throw new NotFoundException('Payment not found');
    const [m] = await this.db.db
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, pay.milestoneId));
    return {
      id: pay.id,
      status: pay.status,
      provider: pay.provider,
      amount: pay.amount,
      buyerFeeAmount: pay.buyerFeeAmount,
      currency: pay.currency,
      milestoneId: pay.milestoneId,
      projectId: m?.projectId ?? null,
      checkoutUrl: pay.status === 'pending' ? pay.checkoutUrl : null,
    };
  }

  /** Test provider only: the "hosted checkout" page reports its result as a SIGNED webhook through the real pipeline. */
  async simulate(actor: RequestActor, paymentId: string, outcome: 'succeeded' | 'failed') {
    if (!(this.provider instanceof TestPaymentsProvider)) {
      throw new NotFoundException('Simulated checkout is only available with PAYMENTS_PROVIDER=test');
    }
    const [pay] = await this.db.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.payerId, actor.userId)));
    if (!pay) throw new NotFoundException('Payment not found');
    const body = JSON.stringify({
      id: `evt_test_${randomUUID()}`,
      type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
      paymentId: pay.id,
      amount: pay.amount + pay.buyerFeeAmount,
      ...(outcome === 'failed' && { failureReason: 'declined in test checkout' }),
    });
    await this.processWebhook(Buffer.from(body), { 'x-test-signature': this.provider.sign(body) });
    return this.getPayment(actor, paymentId);
  }

  // ---- webhooks --------------------------------------------------------------------

  /**
   * Verify → store the raw event (unique per provider event id) → process idempotently. A duplicate of an
   * already-processed event is acknowledged without doing anything; an unprocessed one is retried.
   */
  async processWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    let parsed: ParsedEvent;
    try {
      parsed = this.provider.verifyAndParse(rawBody, headers);
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError)
        throw new BadRequestException('Invalid webhook signature');
      throw err;
    }
    const [inserted] = await this.db.db
      .insert(webhookEvents)
      .values({
        provider: this.provider.name,
        eventId: parsed.eventId,
        type: parsed.type,
        payload: parsed.raw as object,
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    const [event] = inserted
      ? [inserted]
      : await this.db.db
          .select({ id: webhookEvents.id, processedAt: webhookEvents.processedAt })
          .from(webhookEvents)
          .where(
            and(eq(webhookEvents.provider, this.provider.name), eq(webhookEvents.eventId, parsed.eventId)),
          );
    if (!event) throw new Error('webhook event vanished');
    if (!inserted && 'processedAt' in event && event.processedAt) return { received: true, duplicate: true };
    await this.applyStoredEvent(event.id, parsed);
    return { received: true, duplicate: false };
  }

  /** Admin replay: re-run processing of a stored event (safe because processing is idempotent). */
  async replay(eventId: string) {
    const [ev] = await this.db.db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    if (!ev) throw new NotFoundException('Webhook event not found');
    if (ev.provider !== this.provider.name)
      throw new UnprocessableEntityException('Event belongs to another provider');
    await this.applyStoredEvent(ev.id, this.provider.parseStored(ev.payload));
    const [after] = await this.db.db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    return after;
  }

  async listWebhookEvents(onlyFailed: boolean) {
    const rows = await this.db.db.select().from(webhookEvents).orderBy(desc(webhookEvents.id)).limit(100);
    return onlyFailed ? rows.filter((r) => r.error || !r.processedAt) : rows;
  }

  private async applyStoredEvent(storedId: string, parsed: ParsedEvent) {
    let funded: { projectId: string; milestoneId: string; payerId: string } | null = null;
    try {
      await this.db.db.transaction(async (tx) => {
        if (parsed.type === 'payment.succeeded') funded = await this.applySucceeded(tx, parsed);
        else if (parsed.type === 'payment.failed') await this.applyFailed(tx, parsed);
        await tx
          .update(webhookEvents)
          .set({ processedAt: new Date(), error: null })
          .where(eq(webhookEvents.id, storedId));
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.db.update(webhookEvents).set({ error: message }).where(eq(webhookEvents.id, storedId));
      this.logger.error({ err, eventId: parsed.eventId }, 'webhook processing failed');
      // 500 so the provider retries; the stored event also lets an admin replay it.
      throw err;
    }
    const f = funded as { projectId: string; milestoneId: string; payerId: string } | null;
    if (f) await this.notifier.event(f.projectId, f.payerId, 'milestone.funded', f.milestoneId);
  }

  private async applyFailed(tx: DbTx, parsed: ParsedEvent) {
    if (!parsed.paymentId) return;
    await tx
      .update(payments)
      .set({ status: 'failed', failureReason: parsed.failureReason ?? 'payment failed' })
      .where(and(eq(payments.id, parsed.paymentId), eq(payments.status, 'pending')));
  }

  private async applySucceeded(
    tx: DbTx,
    parsed: ParsedEvent,
  ): Promise<{ projectId: string; milestoneId: string; payerId: string } | null> {
    if (!parsed.paymentId) throw new Error('payment.succeeded event without a payment id');
    const [pay] = await tx.select().from(payments).where(eq(payments.id, parsed.paymentId)).for('update');
    if (!pay) throw new Error(`Unknown payment ${parsed.paymentId}`);
    if (pay.status === 'succeeded') return null; // idempotent
    if (pay.status !== 'pending')
      throw new Error(`Payment ${pay.id} is ${pay.status}; manual review required`);
    const expected = pay.amount + pay.buyerFeeAmount;
    if (parsed.amount !== undefined && parsed.amount !== expected) {
      throw new Error(`Provider charged ${parsed.amount}, expected ${expected}; manual review required`);
    }

    const [m] = await tx.select().from(milestones).where(eq(milestones.id, pay.milestoneId)).for('update');
    if (!m || m.status !== 'pending') {
      throw new Error(
        `Milestone ${pay.milestoneId} is not fundable (${m?.status ?? 'missing'}); refund required`,
      );
    }
    const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId));
    if (!p) throw new Error('Project missing');

    const quote = await this.fees.quote(m.amount, tx);
    const next = transition(milestoneMachineRef, m.status, 'fund', 'system');
    await tx.update(milestones).set({ status: next }).where(eq(milestones.id, m.id));
    await tx.update(payments).set({ status: 'succeeded' }).where(eq(payments.id, pay.id));
    await tx.insert(escrowHolds).values({
      milestoneId: m.id,
      paymentId: pay.id,
      amount: m.amount,
      sellerCommissionAmount: quote.sellerCommission,
      currency: m.currency,
    });

    const lines = [
      { account: accounts.cash(), amount: pay.amount + pay.buyerFeeAmount },
      { account: accounts.escrow(m.id), amount: -pay.amount },
      ...(pay.buyerFeeAmount > 0 ? [{ account: accounts.revenue(), amount: -pay.buyerFeeAmount }] : []),
    ];
    await this.ledger.post(tx, {
      kind: 'charge',
      referenceType: 'payment',
      referenceId: pay.id,
      idempotencyKey: `charge:${pay.id}`,
      currency: m.currency,
      description: `Milestone funded: ${p.code} · ${m.title}`,
      lines,
    });

    await tx.insert(invoices).values({
      userId: pay.payerId,
      paymentId: pay.id,
      currency: m.currency,
      totalAmount: pay.amount + pay.buyerFeeAmount,
      lineItems: [
        { description: `${p.code} · ${m.title} (held until you approve)`, amount: pay.amount },
        ...(pay.buyerFeeAmount > 0 ? [{ description: 'Service fee', amount: pay.buyerFeeAmount }] : []),
      ],
    });
    await tx.insert(projectEvents).values({
      projectId: p.id,
      actorId: pay.payerId,
      type: 'milestone.funded',
      payload: { milestoneId: m.id, title: m.title, amount: pay.amount, paymentId: pay.id },
    });
    await tx.insert(auditLogs).values({
      actorId: pay.payerId,
      action: 'milestone.funded',
      entityType: 'milestone',
      entityId: m.id,
      before: { status: 'pending' },
      after: { status: next, paymentId: pay.id, amount: pay.amount, buyerFee: pay.buyerFeeAmount },
    });
    return { projectId: p.id, milestoneId: m.id, payerId: pay.payerId };
  }

  /** Provider refund (idempotent per payment) — called by MilestonesService before it books the reversal. */
  async providerRefund(payment: {
    id: string;
    providerRef: string | null;
    amount: number;
    buyerFeeAmount: number;
  }) {
    if (!payment.providerRef) throw new BadRequestException('Payment has no provider reference');
    return this.provider.refund({
      providerRef: payment.providerRef,
      amount: payment.amount + payment.buyerFeeAmount,
      idempotencyKey: `refund:${payment.id}`,
    });
  }
}
