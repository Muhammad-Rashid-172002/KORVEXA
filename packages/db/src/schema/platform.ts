import { index, inet, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { createdAt, id, updatedAt } from './_common';

/** Append-only audit trail for money and state changes (UPDATE/DELETE blocked by trigger). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    ip: inet(),
    requestId: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorId),
  ],
);

/** Admin-editable settings, e.g. fees (DECISIONS D-045). */
export const platformSettings = pgTable('platform_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  description: text(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Messages from the public Contact page. Staff read them in the admin area; nothing is auto-replied. */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    name: text().notNull(),
    email: text().notNull(),
    topic: text().notNull(),
    message: text().notNull(),
    status: text().notNull().default('new'),
    createdAt: createdAt(),
  },
  (t) => [index('contact_messages_status_idx').on(t.status, t.createdAt)],
);
