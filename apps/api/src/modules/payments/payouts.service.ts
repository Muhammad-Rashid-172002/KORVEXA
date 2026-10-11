import {
  and,
  auditLogs,
  desc,
  eq,
  escrowHolds,
  invoices,
  milestones,
  payouts,
  profiles,
  projects,
  sql,
  transfers,
  type DbClient,
} from '@glasswork/db';
import { brand, MIN_PAYOUT_AMOUNT, type EarningsView, type InvoiceView } from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { accounts, LedgerService } from './ledger.service';

/** Seller balances, payout requests (manual-bank rail for now, D-020) and the invoice list/PDF. */
@Injectable()
export class PayoutsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly ledger: LedgerService,
  ) {}

  async earnings(actor: RequestActor): Promise<EarningsView> {
    const available = await this.ledger.creditBalance(accounts.sellerPayable(actor.userId).code);
    const myPayouts = await this.db.db
      .select()
      .from(payouts)
      .where(eq(payouts.sellerId, actor.userId))
      .orderBy(desc(payouts.id))
      .limit(50);
    const pending = myPayouts
      .filter((p) => p.status === 'requested' || p.status === 'processing')
      .reduce((s, p) => s + p.amount, 0);
    const paid = myPayouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

    const held = await this.db.db
      .select({ amount: escrowHolds.amount })
      .from(escrowHolds)
      .innerJoin(milestones, eq(milestones.id, escrowHolds.milestoneId))
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(eq(projects.sellerId, actor.userId), eq(escrowHolds.status, 'held')));
    const tr = await this.db.db
      .select({ t: transfers, code: projects.code, title: milestones.title })
      .from(transfers)
      .innerJoin(escrowHolds, eq(escrowHolds.id, transfers.escrowHoldId))
      .innerJoin(milestones, eq(milestones.id, escrowHolds.milestoneId))
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(eq(transfers.sellerId, actor.userId))
      .orderBy(desc(transfers.id))
      .limit(50);
    return {
      currency: 'USD',
      available,
      inEscrow: held.reduce((s, h) => s + h.amount, 0),
      pendingPayout: pending,
      paidOut: paid,
      minPayout: MIN_PAYOUT_AMOUNT,
      payoutRails: [
        {
          rail: 'manual_bank',
          available: true,
          note: 'Operations pays you by bank transfer and records the reference.',
        },
        {
          rail: 'stripe_connect',
          available: false,
          note: 'Not available yet: depends on the platform’s legal entity and your country (DECISIONS D-020).',
        },
      ],
      transfers: tr.map((r) => ({
        id: r.t.id,
        project: r.code,
        milestone: r.title,
        gross: r.t.grossAmount,
        fee: r.t.sellerFeeAmount,
        net: r.t.netAmount,
        createdAt: r.t.createdAt.toISOString(),
      })),
      payouts: myPayouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        rail: p.rail,
        createdAt: p.createdAt.toISOString(),
        providerRef: p.providerRef,
      })),
    };
  }

  /** Reserves the amount immediately (seller_payable → payout_clearing) so it cannot be requested twice. */
  async requestPayout(actor: RequestActor, amount: number | undefined) {
    return this.db.db.transaction(async (tx) => {
      // Serialise requests per seller so two concurrent calls cannot both pass the balance check.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'payout:' + actor.userId}))`);
      const balance = await this.ledger.creditBalance(accounts.sellerPayable(actor.userId).code, tx);
      const wanted = amount ?? balance;
      if (wanted < MIN_PAYOUT_AMOUNT) {
        throw new UnprocessableEntityException(
          `The minimum payout is ${(MIN_PAYOUT_AMOUNT / 100).toFixed(2)} USD`,
        );
      }
      if (wanted > balance) throw new UnprocessableEntityException('Amount exceeds your available balance');
      const [row] = await tx
        .insert(payouts)
        .values({ sellerId: actor.userId, rail: 'manual_bank', amount: wanted, currency: 'USD' })
        .returning();
      if (!row) throw new Error('insert failed');
      await this.ledger.post(tx, {
        kind: 'payout_request',
        referenceType: 'payout',
        referenceId: row.id,
        idempotencyKey: `payout-request:${row.id}`,
        currency: 'USD',
        lines: [
          { account: accounts.sellerPayable(actor.userId), amount: wanted },
          { account: accounts.payoutClearing(), amount: -wanted },
        ],
      });
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'payout.requested',
        entityType: 'payout',
        entityId: row.id,
        after: { amount: wanted, rail: row.rail },
      });
      return { id: row.id, amount: wanted, status: row.status };
    });
  }

  async adminList(status?: string) {
    const rows = await this.db.db
      .select({ payout: payouts, sellerName: profiles.displayName })
      .from(payouts)
      .innerJoin(profiles, eq(profiles.userId, payouts.sellerId))
      .orderBy(desc(payouts.id))
      .limit(100);
    return rows
      .filter((r) => !status || r.payout.status === status)
      .map((r) => ({ ...r.payout, sellerName: r.sellerName }));
  }

  /** Operations marks a manual payout as paid (money leaves platform cash) or failed (reservation reversed). */
  async decide(
    admin: RequestActor,
    payoutId: string,
    decision: 'paid' | 'failed',
    reference?: string,
    note?: string,
  ) {
    return this.db.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for('update');
      if (!p) throw new NotFoundException('Payout not found');
      if (p.status !== 'requested' && p.status !== 'processing') {
        throw new UnprocessableEntityException(`Payout is already ${p.status}`);
      }
      if (decision === 'paid' && !reference)
        throw new UnprocessableEntityException('A bank reference is required to mark a payout as paid');
      await tx
        .update(payouts)
        .set({
          status: decision,
          approvedBy: admin.userId,
          providerRef: reference ?? null,
          note: note ?? null,
          paidAt: decision === 'paid' ? new Date() : null,
        })
        .where(eq(payouts.id, payoutId));
      await this.ledger.post(tx, {
        kind: decision === 'paid' ? 'payout' : 'payout_reversal',
        referenceType: 'payout',
        referenceId: p.id,
        idempotencyKey: `payout-${decision}:${p.id}`,
        currency: p.currency,
        lines:
          decision === 'paid'
            ? [
                { account: accounts.payoutClearing(), amount: p.amount },
                { account: accounts.cash(), amount: -p.amount },
              ]
            : [
                { account: accounts.payoutClearing(), amount: p.amount },
                { account: accounts.sellerPayable(p.sellerId), amount: -p.amount },
              ],
      });
      await tx.insert(auditLogs).values({
        actorId: admin.userId,
        action: `payout.${decision}`,
        entityType: 'payout',
        entityId: p.id,
        before: { status: p.status },
        after: { status: decision, reference: reference ?? null, note: note ?? null },
      });
      return { id: p.id, status: decision };
    });
  }

  // ---- invoices -------------------------------------------------------------------

  async listInvoices(actor: RequestActor): Promise<InvoiceView[]> {
    const rows = await this.db.db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, actor.userId))
      .orderBy(desc(invoices.id))
      .limit(100);
    return rows.map(toInvoiceView);
  }

  async invoicePdf(actor: RequestActor, invoiceId: string): Promise<{ filename: string; bytes: Uint8Array }> {
    const [inv] = await this.db.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, actor.userId)));
    if (!inv) throw new NotFoundException('Invoice not found');
    return { filename: `${inv.number}.pdf`, bytes: await renderInvoicePdf(toInvoiceView(inv)) };
  }
}

const toInvoiceView = (i: typeof invoices.$inferSelect): InvoiceView => ({
  id: i.id,
  number: i.number,
  totalAmount: i.totalAmount,
  currency: i.currency,
  issuedAt: i.issuedAt.toISOString(),
  lineItems: i.lineItems as InvoiceView['lineItems'],
});

const fmt = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`;

/** Receipt PDF with the fee breakdown. Legal entity/address are placeholders until Q2 is answered (brand.ts). */
export async function renderInvoicePdf(inv: InvoiceView): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const line = (
    text: string,
    opts: { size?: number; bold?: boolean; x?: number; color?: [number, number, number] } = {},
  ) => {
    page.drawText(text, {
      x: opts.x ?? 50,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? bold : font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])),
    });
    y -= (opts.size ?? 11) + 8;
  };
  line(brand.lockup, { size: 18, bold: true });
  line(`${brand.legalEntity}`, { size: 9, color: [0.4, 0.4, 0.4] });
  y -= 10;
  line(`Receipt ${inv.number}`, { size: 14, bold: true });
  line(`Issued ${inv.issuedAt.slice(0, 10)}`, { color: [0.4, 0.4, 0.4] });
  y -= 14;
  for (const item of inv.lineItems) {
    line(item.description.slice(0, 70), { x: 50 });
    y += 19;
    page.drawText(fmt(item.amount, inv.currency), { x: 440, y, size: 11, font });
    y -= 19;
  }
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 18;
  line('Total paid', { bold: true });
  y += 19;
  page.drawText(fmt(inv.totalAmount, inv.currency), { x: 440, y, size: 11, font: bold });
  y -= 40;
  line('Milestone payments are held by the platform until you approve the work (test-mode receipt).', {
    size: 9,
    color: [0.4, 0.4, 0.4],
  });
  return doc.save();
}
