import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_common';
import { users } from './auth';
import { projects } from './commerce';

export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizerId: uuid().references(() => users.id, { onDelete: 'set null' }),
    title: text().notNull(),
    agenda: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: text().notNull().default('scheduled'),
    recordingRequested: boolean().notNull().default(false),
    provider: text().notNull(),
    roomName: text(),
    roomUrl: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('meetings_project_idx').on(t.projectId, t.startsAt)],
);

/** One row per participant who answered the recording question. No row = not answered = treated as "no". */
export const meetingConsents = pgTable(
  'meeting_consents',
  {
    meetingId: uuid()
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consent: boolean().notNull(),
    decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.userId] })],
);

/** A GitHub repository the seller connected to a project; webhooks for that repo feed the project's code activity. */
export const codeLinks = pgTable(
  'code_links',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repo: text().notNull(),
    /** Lower-cased `owner/name` for case-insensitive webhook matching. */
    repoKey: text().notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('code_links_project_repo_uq').on(t.projectId, t.repoKey),
    index('code_links_repo_idx').on(t.repoKey),
  ],
);

export const codeEvents = pgTable(
  'code_events',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** GitHub's X-GitHub-Delivery id: makes redelivered webhooks idempotent. */
    deliveryId: text().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    detail: text(),
    url: text(),
    actor: text(),
    repo: text().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('code_events_delivery_uq').on(t.projectId, t.deliveryId),
    index('code_events_project_idx').on(t.projectId, t.occurredAt),
  ],
);
