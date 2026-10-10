import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/** UUIDv7 primary key generated in the app (DECISIONS D-005). */
export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const createdAt = () => timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Dev-seed marker so seeded rows can never leak into real metrics (DECISIONS D-027). */
export const isSeed = () => boolean().notNull().default(false);
