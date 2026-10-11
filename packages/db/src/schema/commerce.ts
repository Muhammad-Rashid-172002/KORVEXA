import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  date,
  index,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { sellerProfiles } from './accounts';
import { users } from './auth';
import { servicePackages, services } from './catalogue';
import {
  briefStatus,
  healthState,
  milestoneStatus,
  participantRole,
  projectStatus,
  proposalStatus,
} from './enums';
import { organizations } from './accounts';

export const projectCodeSeq = pgSequence('project_code_seq', { startWith: 1 });

/** Buyer's posted request ("buyer requests board"); sellers answer with proposals. */
export const briefs = pgTable(
  'briefs',
  {
    id: id(),
    buyerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid().references(() => organizations.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text().notNull(),
    structured: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    budgetMinAmount: bigint({ mode: 'number' }),
    budgetMaxAmount: bigint({ mode: 'number' }),
    currency: char({ length: 3 }).notNull().default('USD'),
    aiGenerated: boolean().notNull().default(false),
    status: briefStatus().notNull().default('open'),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('briefs_status_idx').on(t.status, t.id), index('briefs_buyer_idx').on(t.buyerId)],
);

export const proposals = pgTable(
  'proposals',
  {
    id: id(),
    briefId: uuid()
      .notNull()
      .references(() => briefs.id, { onDelete: 'cascade' }),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    coverLetter: text().notNull(),
    /** [{ title, acceptanceCriteria?, amount (minor units), days }] */
    milestonePlan: jsonb().notNull(),
    totalAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    status: proposalStatus().notNull().default('sent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('proposals_brief_idx').on(t.briefId),
    uniqueIndex('proposals_one_active_per_seller_uq')
      .on(t.briefId, t.sellerId)
      .where(sql`${t.status} in ('sent', 'accepted')`),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    /** Human-friendly code, e.g. GW-0001 (never reused). */
    code: text()
      .notNull()
      .unique()
      .default(sql`'GW-' || lpad(nextval('project_code_seq')::text, 4, '0')`),
    buyerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    buyerOrgId: uuid().references(() => organizations.id, { onDelete: 'set null' }),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'restrict' }),
    serviceId: uuid().references(() => services.id, { onDelete: 'set null' }),
    packageId: uuid().references(() => servicePackages.id, { onDelete: 'set null' }),
    proposalId: uuid().references(() => proposals.id, { onDelete: 'set null' }),
    title: text().notNull(),
    status: projectStatus().notNull().default('requirements_submitted'),
    /** Where to return to after paused / disputed. */
    statusBeforeSide: projectStatus(),
    health: healthState().notNull().default('on_track'),
    healthReason: text(),
    totalAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    /** Buyer's answers to the service's requirements form + order notes. */
    requirements: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('projects_buyer_idx').on(t.buyerId, t.id),
    index('projects_seller_idx').on(t.sellerId, t.id),
    index('projects_status_idx').on(t.status),
  ],
);

export const projectParticipants = pgTable(
  'project_participants',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: participantRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index('project_participants_user_idx').on(t.userId),
  ],
);

export const milestones = pgTable(
  'milestones',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    position: smallint().notNull(),
    title: text().notNull(),
    acceptanceCriteria: text(),
    /** Price and progress weight, minor units (D-006). */
    amount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    status: milestoneStatus().notNull().default('pending'),
    plannedStart: date({ mode: 'string' }),
    plannedDue: date({ mode: 'string' }),
    actualSubmittedAt: timestamp({ withTimezone: true }),
    approvedAt: timestamp({ withTimezone: true }),
    autoApproveAt: timestamp({ withTimezone: true }),
    revisionCount: smallint().notNull().default(0),
    submissionNote: text(),
    revisionNote: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('milestones_project_position_uq').on(t.projectId, t.position)],
);

/** Activity feed. Append-only (trigger in migration). */
export const projectEvents = pgTable(
  'project_events',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    type: text().notNull(),
    payload: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index('project_events_project_idx').on(t.projectId, t.id)],
);
