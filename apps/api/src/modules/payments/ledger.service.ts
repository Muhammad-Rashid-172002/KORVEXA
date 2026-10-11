import { eq, ledgerAccounts, ledgerEntries, ledgerTransactions, sql, type Executor } from '@glasswork/db';
import type { LedgerAccountType } from '@glasswork/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { DbClient } from '@glasswork/db';
import { DB } from '../../infra/tokens';

/** Account codes. Dynamic accounts carry the owning id so balances are per milestone / per seller. */
export const accounts = {
  cash: () => ({ code: 'platform_cash', type: 'asset' as LedgerAccountType }),
  revenue: () => ({ code: 'platform_revenue', type: 'revenue' as LedgerAccountType }),
  payoutClearing: () => ({ code: 'payout_clearing', type: 'liability' as LedgerAccountType }),
  escrow: (milestoneId: string) => ({
    code: `escrow:${milestoneId}`,
    type: 'liability' as LedgerAccountType,
  }),
  sellerPayable: (sellerId: string) => ({
    code: `seller_payable:${sellerId}`,
    type: 'liability' as LedgerAccountType,
  }),
};

export interface LedgerLine {
  account: { code: string; type: LedgerAccountType };
  /** Signed minor units: positive = debit, negative = credit. */
  amount: number;
}

export interface LedgerPost {
  kind: string;
  referenceType: string;
  referenceId: string;
  description?: string;
  /** Re-posting the same key is a no-op, so retried webhooks/jobs never double-book. */
  idempotencyKey: string;
  currency: string;
  lines: LedgerLine[];
}

/**
 * Append-only double-entry ledger (D-020). Debits positive, credits negative; every transaction sums to zero
 * (checked here AND by a deferred DB trigger). Liability/revenue balances are therefore negative numbers;
 * `balanceOf` returns them as positive "amount owed" values for readability.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  /** Posts one balanced transaction on `exec` (pass the caller's transaction). Returns false if already posted. */
  async post(exec: Executor, tx: LedgerPost): Promise<boolean> {
    if (tx.lines.length < 2) throw new Error('A ledger transaction needs at least two lines');
    if (tx.lines.some((l) => !Number.isSafeInteger(l.amount) || l.amount === 0)) {
      throw new Error('Ledger amounts must be non-zero integers');
    }
    if (tx.lines.reduce((s, l) => s + l.amount, 0) !== 0)
      throw new Error(`Unbalanced ledger transaction ${tx.kind}`);

    const [created] = await exec
      .insert(ledgerTransactions)
      .values({
        kind: tx.kind,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        description: tx.description ?? null,
        idempotencyKey: tx.idempotencyKey,
      })
      .onConflictDoNothing({ target: ledgerTransactions.idempotencyKey })
      .returning({ id: ledgerTransactions.id });
    if (!created) return false;

    for (const l of tx.lines) {
      await exec
        .insert(ledgerAccounts)
        .values({ code: l.account.code, type: l.account.type, currency: tx.currency })
        .onConflictDoNothing({ target: ledgerAccounts.code });
    }
    const rows = await exec
      .select({ id: ledgerAccounts.id, code: ledgerAccounts.code })
      .from(ledgerAccounts)
      .where(
        sql`${ledgerAccounts.code} in (${sql.join(
          tx.lines.map((l) => sql`${l.account.code}`),
          sql`, `,
        )})`,
      );
    const idByCode = new Map(rows.map((r) => [r.code, r.id]));
    await exec.insert(ledgerEntries).values(
      tx.lines.map((l) => ({
        transactionId: created.id,
        accountId: idByCode.get(l.account.code)!,
        amount: l.amount,
        currency: tx.currency,
      })),
    );
    return true;
  }

  /** Sum of entries for an account: positive = net debit. */
  async rawBalance(code: string, exec: Executor = this.db.db): Promise<number> {
    const [row] = await exec
      .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text` })
      .from(ledgerEntries)
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
      .where(eq(ledgerAccounts.code, code));
    return Number(row?.total ?? 0);
  }

  /** Amount owed on a liability/revenue account (credit balance as a positive number). */
  async creditBalance(code: string, exec: Executor = this.db.db): Promise<number> {
    return -(await this.rawBalance(code, exec));
  }

  /** Trial balance across the whole ledger; must always be 0. */
  async trialBalance(): Promise<number> {
    const [row] = await this.db.db
      .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text` })
      .from(ledgerEntries);
    return Number(row?.total ?? 0);
  }
}
