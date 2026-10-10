import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { filePurpose, fileStatus } from './enums';

/** Every upload (DECISIONS D-030). Other tables reference files by id. */
export const files = pgTable(
  'files',
  {
    id: id(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: text().notNull().unique(),
    originalName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    purpose: filePurpose().notNull(),
    status: fileStatus().notNull().default('pending'),
    sha256: text(),
    uploadedAt: timestamp({ withTimezone: true }),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('files_owner_id_id_idx').on(t.ownerId, t.id)],
);
