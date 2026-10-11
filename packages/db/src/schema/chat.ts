import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_common';
import { users } from './auth';
import { projects } from './commerce';
import { conversationKind, messageKind, offerStatus } from './enums';
import { files } from './files';

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    kind: conversationKind().notNull(),
    /** Set for project chats; unique so there is exactly one per project. */
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
    /** Sorted `buyerId:sellerId` for direct chats so a pair never gets two conversations. */
    directKey: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('conversations_project_uq')
      .on(t.projectId)
      .where(sql`${t.projectId} is not null`),
    uniqueIndex('conversations_direct_uq')
      .on(t.directKey)
      .where(sql`${t.directKey} is not null`),
  ],
);

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Read receipt: the newest message this member has seen (UUIDv7 ids sort by time). */
    lastReadMessageId: uuid(),
    lastReadAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index('conversation_members_user_idx').on(t.userId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid().references(() => users.id, { onDelete: 'set null' }),
    body: text().notNull().default(''),
    kind: messageKind().notNull().default('text'),
    /** Set for `custom_offer` messages. */
    offerId: uuid(),
    /** Filled by the chat-safety checks in Phase 5 (off-platform contact/payment details). */
    safetyFlags: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    editedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.id)],
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    messageId: uuid()
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.fileId] }),
    index('message_attachments_file_idx').on(t.fileId),
  ],
);

/** A seller's tailored offer sent inside a direct chat; accepting it creates a project. */
export const customOffers = pgTable(
  'custom_offers',
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sellerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    buyerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text().notNull(),
    /** [{ title, acceptanceCriteria?, amount, days }] */
    milestonePlan: jsonb().notNull(),
    totalAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    status: offerStatus().notNull().default('sent'),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('custom_offers_conversation_idx').on(t.conversationId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    /** In-app path to open, e.g. /projects/:id */
    url: text(),
    payload: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.id)],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    inApp: boolean().notNull().default(true),
    email: boolean().notNull().default(true),
    push: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
);
