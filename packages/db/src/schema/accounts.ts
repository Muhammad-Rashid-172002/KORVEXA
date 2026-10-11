import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { orgKind, orgRole, sellerAvailability } from './enums';
import { users } from './auth';
import { files } from './files';

export const skills = pgTable('skills', {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  isSeed: isSeed(),
  createdAt: createdAt(),
});

/** One row per user who has opted into selling (users.roles contains 'seller'). */
export const sellerProfiles = pgTable('seller_profiles', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  availability: sellerAvailability().notNull().default('available'),
  /** Minor units (D-006); null = not set. */
  hourlyRateAmount: bigint({ mode: 'number' }),
  rateCurrency: char({ length: 3 }).notNull().default('USD'),
  yearsExperience: integer(),
  /** Placeholder until the payout rail is decided (Q1/Q6): free-text preference only, no account data. */
  payoutPreference: text(),
  onboardingCompletedAt: timestamp({ withTimezone: true }),
  isSeed: isSeed(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sellerSkills = pgTable(
  'seller_skills',
  {
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    skillId: uuid()
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sellerId, t.skillId] })],
);

export const portfolioItems = pgTable(
  'portfolio_items',
  {
    id: id(),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    url: text(),
    imageFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
    sortOrder: integer().notNull().default(0),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('portfolio_items_seller_idx').on(t.sellerId, t.sortOrder)],
);

export const organizations = pgTable('organizations', {
  id: id(),
  name: text().notNull(),
  kind: orgKind().notNull(),
  createdBy: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  isSeed: isSeed(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRole().notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index('org_members_user_idx').on(t.userId)],
);

export const orgInvites = pgTable(
  'org_invites',
  {
    id: id(),
    orgId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Lower-cased invitee email. */
    email: text().notNull(),
    role: orgRole().notNull().default('member'),
    /** SHA-256 of the emailed token; the raw token is never stored. */
    tokenHash: text().notNull().unique(),
    invitedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('org_invites_org_idx').on(t.orgId),
    uniqueIndex('org_invites_pending_uq')
      .on(t.orgId, t.email)
      .where(sql`${t.acceptedAt} is null`),
  ],
);
