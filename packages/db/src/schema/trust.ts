import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sellerProfiles } from './accounts';
import { users } from './auth';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { milestones, projects } from './commerce';
import {
  changeRequestStatus,
  disputeOutcome,
  disputeStatus,
  evidenceKind,
  reportStatus,
  reportTarget,
  reviewVisibility,
  verificationKind,
  verificationStatus,
} from './enums';
import { files } from './files';

/** `milestoneId` null = the public final review; set = private per-milestone feedback to the seller. */
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid().references(() => milestones.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectSellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    visibility: reviewVisibility().notNull(),
    ratingOverall: smallint().notNull(),
    ratingCommunication: smallint(),
    ratingQuality: smallint(),
    ratingTimeliness: smallint(),
    body: text().notNull().default(''),
    isSeed: isSeed(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('reviews_one_final_uq')
      .on(t.projectId, t.authorId)
      .where(sql`${t.milestoneId} is null`),
    uniqueIndex('reviews_one_per_milestone_uq')
      .on(t.milestoneId, t.authorId)
      .where(sql`${t.milestoneId} is not null`),
    index('reviews_subject_idx').on(t.subjectSellerId, t.visibility, t.id),
  ],
);

export const reviewReplies = pgTable('review_replies', {
  reviewId: uuid()
    .primaryKey()
    .references(() => reviews.id, { onDelete: 'cascade' }),
  authorId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text().notNull(),
  createdAt: createdAt(),
});

/** Seller badge requests. A badge is shown only while status = 'verified'. */
export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    kind: verificationKind().notNull(),
    status: verificationStatus().notNull().default('pending'),
    /** What the seller submitted, e.g. { url, handle, note }. */
    evidence: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    evidenceFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    reviewedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('verifications_user_kind_uq').on(t.userId, t.kind),
    index('verifications_status_idx').on(t.status),
  ],
);

export const changeRequests = pgTable(
  'change_requests',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text().notNull(),
    /** Extra price, minor units (≥ 0). Equals the sum of the new milestones. */
    priceDeltaAmount: bigint({ mode: 'number' }).notNull().default(0),
    /** Days added to every still-open milestone's planned date. */
    daysDelta: integer().notNull().default(0),
    /** New milestones added on acceptance: [{ title, acceptanceCriteria?, amount, days }] */
    milestoneChanges: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: changeRequestStatus().notNull().default('proposed'),
    respondedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    respondedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('change_requests_project_idx').on(t.projectId, t.id)],
);

export const disputes = pgTable(
  'disputes',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid()
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    openedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    status: disputeStatus().notNull().default('open'),
    outcome: disputeOutcome(),
    /** Refunded to the buyer on a split (minor units, milestone portion only). */
    refundAmount: bigint({ mode: 'number' }),
    resolutionNote: text(),
    resolvedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** Auto-collected snapshot at the moment the dispute was opened (messages, deliverables, events…). */
    caseFile: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('disputes_status_idx').on(t.status, t.id),
    index('disputes_project_idx').on(t.projectId),
    uniqueIndex('disputes_one_open_per_milestone_uq')
      .on(t.milestoneId)
      .where(sql`${t.status} <> 'resolved'`),
  ],
);

export const disputeEvidence = pgTable(
  'dispute_evidence',
  {
    id: id(),
    disputeId: uuid()
      .notNull()
      .references(() => disputes.id, { onDelete: 'cascade' }),
    submittedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    kind: evidenceKind().notNull(),
    refId: uuid(),
    note: text(),
    fileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('dispute_evidence_dispute_idx').on(t.disputeId, t.id)],
);

export const reports = pgTable(
  'reports',
  {
    id: id(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: reportTarget().notNull(),
    targetId: uuid().notNull(),
    reason: text().notNull(),
    details: text(),
    status: reportStatus().notNull().default('open'),
    handledBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    handledNote: text(),
    handledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.id),
    index('reports_target_idx').on(t.targetType, t.targetId),
  ],
);
