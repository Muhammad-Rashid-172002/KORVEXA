import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { activeMode, adminScope, userRole } from './enums';

/**
 * Auth tables. Property names follow Better Auth's model fields (camelCase); columns are snake_case.
 * Better Auth's `verification` model is mapped to `auth_tokens` to avoid clashing with seller
 * `verifications` badges (DECISIONS D-010).
 */
export const users = pgTable(
  'users',
  {
    id: id(),
    /** Stored lower-cased (enforced by a check constraint). */
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    name: text().notNull(),
    image: text(),
    roles: userRole()
      .array()
      .notNull()
      .default(sql`'{buyer}'::user_role[]`),
    adminScopes: adminScope()
      .array()
      .notNull()
      .default(sql`'{}'::admin_scope[]`),
    activeMode: activeMode().notNull().default('buyer'),
    twoFactorEnabled: boolean().notNull().default(false),
    bannedAt: timestamp({ withTimezone: true }),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('users_email_lowercase_ck', sql`${t.email} = lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'credential' | 'google' | 'github' */
    providerId: text().notNull(),
    accountId: text().notNull(),
    /** argon2id hash — credential accounts only. */
    password: text('password_hash'),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('accounts_user_id_idx').on(t.userId),
    uniqueIndex('accounts_provider_account_uq').on(t.providerId, t.accountId),
  ],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_tokens_identifier_idx').on(t.identifier)],
);

export const profiles = pgTable('profiles', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text().notNull(),
  /** Public URL handle, set when the user publishes a profile. Lower-case. */
  slug: text().unique(),
  avatarFileId: uuid(),
  headline: text(),
  bio: text(),
  country: text(),
  timezone: text(),
  languages: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  isSeed: isSeed(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** TOTP secrets + backup codes (Better Auth twoFactor plugin; values are encrypted by the plugin). */
export const twoFactors = pgTable(
  'two_factors',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text().notNull(),
    backupCodes: text().notNull(),
    verified: boolean().notNull().default(true),
    failedVerificationCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('two_factors_user_id_idx').on(t.userId)],
);
