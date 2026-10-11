import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_common';
import { users } from './auth';
import { briefs, projects } from './commerce';

/** One row per model call: real token counts and computed cost (micro-USD). Drives rate limits, daily caps and admin cost views. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    feature: text().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    cacheReadTokens: integer().notNull().default(0),
    cacheWriteTokens: integer().notNull().default(0),
    costMicros: bigint({ mode: 'number' }).notNull().default(0),
    ok: boolean().notNull().default(true),
    error: text(),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_usage_user_day_idx').on(t.userId, t.createdAt),
    index('ai_usage_day_idx').on(t.createdAt),
  ],
);

/** Conversation state for the AI brief builder (idea → clarifying questions → structured brief). */
export const aiBriefSessions = pgTable(
  'ai_brief_sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    idea: text().notNull(),
    status: text().notNull().default('asking'),
    questions: jsonb()
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    answers: jsonb()
      .$type<{ question: string; answer: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    brief: jsonb(),
    postedBriefId: uuid().references(() => briefs.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('ai_brief_sessions_user_idx').on(t.userId, t.createdAt)],
);

/** Seller-reviewed progress reports. A draft is private to the seller; only `sent` reports are visible to the buyer. */
export const progressReports = pgTable(
  'progress_reports',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    status: text().notNull().default('draft'),
    periodStart: timestamp({ withTimezone: true }).notNull(),
    periodEnd: timestamp({ withTimezone: true }).notNull(),
    content: jsonb().notNull(),
    edited: boolean().notNull().default(false),
    generatedBy: text().notNull().default('ai'),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('progress_reports_project_idx').on(t.projectId, t.createdAt)],
);
