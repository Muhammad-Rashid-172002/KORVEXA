import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { users } from './auth';
import { milestones, projects } from './commerce';
import { deliverableStatus, previewKind, taskSource, taskStatus } from './enums';
import { files } from './files';

/** Kanban item. `projectId` is denormalised so every query can be scoped to a project without joins. */
export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid().references(() => milestones.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    status: taskStatus().notNull().default('todo'),
    sortOrder: integer().notNull().default(0),
    assigneeId: uuid().references(() => users.id, { onDelete: 'set null' }),
    source: taskSource().notNull().default('manual'),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tasks_project_status_idx').on(t.projectId, t.status, t.sortOrder),
    index('tasks_milestone_idx').on(t.milestoneId),
  ],
);

export const taskComments = pgTable(
  'task_comments',
  {
    id: id(),
    taskId: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('task_comments_task_idx').on(t.taskId, t.id)],
);

/** Versioned upload per milestone; older versions become `superseded`. */
export const deliverables = pgTable(
  'deliverables',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid()
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'restrict' }),
    note: text(),
    status: deliverableStatus().notNull().default('submitted'),
    submittedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('deliverables_milestone_version_uq').on(t.milestoneId, t.version),
    index('deliverables_project_idx').on(t.projectId),
    index('deliverables_file_idx').on(t.fileId),
  ],
);

/** Feedback pinned to a place in a deliverable: { kind: 'page'|'region'|'timecode', page?, x?, y?, w?, h?, t? }. */
export const deliverableFeedback = pgTable(
  'deliverable_feedback',
  {
    id: id(),
    deliverableId: uuid()
      .notNull()
      .references(() => deliverables.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    anchor: jsonb()
      .notNull()
      .default(sql`'{}'::jsonb`),
    body: text().notNull(),
    resolved: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('deliverable_feedback_deliverable_idx').on(t.deliverableId, t.id)],
);

export const previewLinks = pgTable(
  'preview_links',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid().references(() => milestones.id, { onDelete: 'set null' }),
    kind: previewKind().notNull(),
    label: text().notNull(),
    url: text().notNull(),
    lastUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('preview_links_project_idx').on(t.projectId)],
);
