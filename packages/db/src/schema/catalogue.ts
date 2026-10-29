import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createdAt, id, isSeed, updatedAt } from './_common';
import { sellerProfiles } from './accounts';
import { users } from './auth';
import { packageTier, serviceStatus } from './enums';
import { files } from './files';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const categories = pgTable(
  'categories',
  {
    id: id(),
    parentId: uuid().references((): AnyPgColumn => categories.id, { onDelete: 'restrict' }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('categories_parent_idx').on(t.parentId)],
);

/** A seller's gig. Ranking never reads `operatedByPlatform` (DECISIONS D-002). */
export const services = pgTable(
  'services',
  {
    id: id(),
    sellerId: uuid()
      .notNull()
      .references(() => sellerProfiles.userId, { onDelete: 'cascade' }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text().notNull(),
    /** Questions the buyer answers at order time: [{ id, label, type, required }]. */
    requirementsForm: jsonb()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Seller-chosen search tags (lowercase, max 5). */
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: serviceStatus().notNull().default('draft'),
    rejectionReason: text(),
    /** Label only ("Operated by KorvenzaTech"); set by an admin, never used for ranking. */
    operatedByPlatform: boolean().notNull().default(false),
    publishedAt: timestamp({ withTimezone: true }),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
    ),
    isSeed: isSeed(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('services_seller_idx').on(t.sellerId),
    index('services_category_status_idx').on(t.categoryId, t.status),
    index('services_status_published_idx').on(t.status, t.publishedAt),
    index('services_search_vector_idx').using('gin', t.searchVector),
    index('services_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
  ],
);

export const servicePackages = pgTable(
  'service_packages',
  {
    id: id(),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    tier: packageTier().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    /** Minor units (D-006). */
    priceAmount: bigint({ mode: 'number' }).notNull(),
    currency: char({ length: 3 }).notNull().default('USD'),
    deliveryDays: integer().notNull(),
    revisions: integer().notNull().default(1),
    /** Optional milestone split: [{ title, percent }] summing to 100. Null = platform default (D-066). */
    milestoneTemplate: jsonb(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('service_packages_tier_uq').on(t.serviceId, t.tier)],
);

export const serviceExtras = pgTable(
  'service_extras',
  {
    id: id(),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    priceAmount: bigint({ mode: 'number' }).notNull(),
    extraDays: integer().notNull().default(0),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index('service_extras_service_idx').on(t.serviceId)],
);

export const serviceFaqs = pgTable(
  'service_faqs',
  {
    id: id(),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    question: text().notNull(),
    answer: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index('service_faqs_service_idx').on(t.serviceId)],
);

export const serviceImages = pgTable(
  'service_images',
  {
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.fileId] })],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.serviceId] })],
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    query: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('saved_searches_user_idx').on(t.userId)],
);
