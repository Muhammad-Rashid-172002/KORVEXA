import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { sellerProfiles } from './accounts';
import { users } from './auth';
import { milestones } from './commerce';
import {
  escrowStatus,
  ledgerAccountType,
  paymentStatus,
  payoutRail,
  payoutStatus,
  transferStatus,
} from './enums';

export const invoiceNumberSeq = pgSequence('invoice_number_seq', { startWith: 1 });

/** One charge attempt for one milestone (milestones are funded separately, brief §8.5). */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    milestoneId: uuid()
      .notNull()
      .references(() => milestones.id, { onDelete: 'restrict' }),
    payerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Milestone price (minor units). Always computed server-side from the DB. */
    amount: bigint({ mode: 'number' }).notNull(),
    buyerFeeAmount: bigint({ mode: 'number' }).notNull().default(0),
    currency: char({ length: 3 }).notNull().default('USD'),
    /** 'stripe' | 'test' */
    provider: text().notNull(),
    providerRef: text().unique(),
    checkoutUrl: text(),
    status: paymentStatus().notNull().default('pending'),
    failureReason: text(),
    idempotencyKey: text().notNull().unique(),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('payments_milestone_idx').on(t.milestoneId),
    index('payments_payer_idx').on(t.payerId, t.id),
    // At most one live attempt per milestone at a time; failed attempts may be retried.
    uniqueIndex('payments_one_open_per_milestone_uq')
      .on(t.milestoneId)
      .where(sql`${t.status} in ('pending', 'succeeded')`),
  ],
);

export const escrowHolds = pgTable('escrow_holds', {
  id: id(),
  milestoneId: uuid()
    .notNull()
    .unique()
    .references(() => milestones.id, { onDelete: 'restrict' }),
  paymentId: uuid()
    .notNull()
    .references(() => payments.id, { onDelete: 'restrict' }),
  amount: bigint({ mode: 'number' }).notNull(),
  /** Fixed when the milestone is funded so later fee-setting changes never alter an in-flight milestone. */
  sellerCommissionAmount: bigint({ mode: 'number' }).notNull().default(0),
  currency: char({ length: 3 }).notNull().default('USD'),
  status: escrowStatus().notNull().default('held'),
  releasedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const transfers = pgTable(
  'transfers',
  {
    id: id(),
    escrowHoldId: uuid()
      .notNull()
      .unique()
      .references(() => escrowHolds.id, { onDelete: 'restrict' }),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'restrict' }),
    grossAmount: bigint({ mode: 'number' }).notNull(),
    sellerFeeAmount: bigint({ mode: 'number' }).notNull(),
    netAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    status: transferStatus().notNull().default('completed'),
    createdAt: createdAt(),
  },
  (t) => [index('transfers_seller_idx').on(t.sellerId, t.id)],
);

export const payouts = pgTable(
  'payouts',
  {
    id: id(),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'restrict' }),
    rail: payoutRail().notNull(),
    amount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    providerRef: text(),
    status: payoutStatus().notNull().default('requested'),
    /** Operations admin who marked a manual payout as paid / failed. */
    approvedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    note: text(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payouts_seller_idx').on(t.sellerId, t.id), index('payouts_status_idx').on(t.status)],
);

/** Double-entry ledger (D-020). Accounts are created lazily by code. */
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: id(),
  /** platform_cash | platform_revenue | payout_clearing | escrow:{milestoneId} | seller_payable:{userId} */
  code: text().notNull().unique(),
  type: ledgerAccountType().notNull(),
  currency: char({ length: 3 }).notNull().default('USD'),
  createdAt: createdAt(),
});

/** Append-only (trigger in migration). */
export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: id(),
    kind: text().notNull(),
    referenceType: text().notNull(),
    referenceId: uuid(),
    description: text(),
    idempotencyKey: text().notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index('ledger_tx_reference_idx').on(t.referenceType, t.referenceId)],
);

/** Append-only; entries of one transaction must sum to zero (deferred constraint trigger in migration). */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: id(),
    transactionId: uuid()
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: 'restrict' }),
    accountId: uuid()
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    /** Signed minor units: positive = debit, negative = credit. */
    amount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_entries_tx_idx').on(t.transactionId),
    index('ledger_entries_account_idx').on(t.accountId),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    /** GW-INV-2026-000001 */
    number: text()
      .notNull()
      .unique()
      .default(
        sql`'GW-INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')`,
      ),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    paymentId: uuid()
      .notNull()
      .unique()
      .references(() => payments.id, { onDelete: 'restrict' }),
    lineItems: jsonb().notNull(),
    totalAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invoices_user_idx').on(t.userId, t.id)],
);

/** Raw provider events, stored before processing; unique per provider event id (idempotent). */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    provider: text().notNull(),
    eventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_uq').on(t.provider, t.eventId)],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text().notNull(),
    requestHash: text().notNull(),
    responseStatus: bigint({ mode: 'number' }),
    response: jsonb(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scope, t.key] })],
);
