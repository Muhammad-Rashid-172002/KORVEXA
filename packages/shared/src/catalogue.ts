import { z } from 'zod';
import { PACKAGE_TIERS, SERVICE_STATUSES } from './enums';
import { SELLER_LEVEL_KEYS, type SellerLevelKey } from './trust';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const packageInputSchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  title: text(2, 60),
  description: text(10, 1000),
  /** Minor units: 500 = $5.00 minimum, $100,000 maximum. */
  priceAmount: z.number().int().min(500).max(10_000_000),
  deliveryDays: z.number().int().min(1).max(180),
  revisions: z.number().int().min(0).max(20).default(1),
});

export const extraInputSchema = z.object({
  title: text(2, 80),
  priceAmount: z.number().int().min(100).max(10_000_000),
  extraDays: z.number().int().min(0).max(90).default(0),
});

export const faqInputSchema = z.object({ question: text(3, 200), answer: text(3, 1000) });

export const requirementFieldSchema = z.object({
  label: text(2, 200),
  type: z.enum(['text', 'longtext', 'file']),
  required: z.boolean().default(true),
});

export const serviceInputSchema = z
  .object({
    categoryId: z.uuid(),
    title: text(10, 100),
    description: text(50, 5000),
    requirementsForm: z.array(requirementFieldSchema).max(10).default([]),
    packages: z.array(packageInputSchema).min(1).max(3),
    extras: z.array(extraInputSchema).max(10).default([]),
    faqs: z.array(faqInputSchema).max(10).default([]),
    imageFileIds: z.array(z.uuid()).max(6).default([]),
  })
  .refine((v) => new Set(v.packages.map((p) => p.tier)).size === v.packages.length, {
    message: 'Each package tier may appear once',
    path: ['packages'],
  });
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const SERVICE_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'rating'] as const;

export const serviceSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  maxDelivery: z.coerce.number().int().min(1).max(365).optional(),
  /** Real data only: sellers with no public reviews never match a rating filter. */
  minRating: z.coerce.number().min(1).max(5).optional(),
  /** Minimum seller level (computed from published criteria). */
  level: z.enum(SELLER_LEVEL_KEYS).optional(),
  verifiedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : undefined)),
  sort: z.enum(SERVICE_SORTS).optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export type ServiceSearchQuery = z.infer<typeof serviceSearchSchema>;

export const savedSearchInputSchema = z.object({
  name: text(2, 80),
  query: serviceSearchSchema.omit({ cursor: true, limit: true }),
});

export const moderationDecisionSchema = z.object({ reason: text(5, 500) });
export const platformFlagSchema = z.object({ operatedByPlatform: z.boolean() });
export const adminServicesQuerySchema = z.object({
  status: z.enum(SERVICE_STATUSES).default('pending_review'),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** Response shapes shared by API and web. */
export interface ServiceCardView {
  id: string;
  slug: string;
  title: string;
  category: { slug: string; name: string };
  seller: { id: string; slug: string | null; displayName: string; avatarUrl: string | null };
  fromPrice: number;
  currency: string;
  minDeliveryDays: number;
  imageUrl: string | null;
  operatedByPlatform: boolean;
  status: (typeof SERVICE_STATUSES)[number];
  /** Real, computed trust signals (null/0 when there is no data yet). */
  trust: {
    level: SellerLevelKey;
    levelLabel: string;
    avgRating: number | null;
    reviewCount: number;
    verified: boolean;
  };
}

export interface ServiceDetailView extends ServiceCardView {
  description: string;
  rejectionReason: string | null;
  requirementsForm: z.infer<typeof requirementFieldSchema>[];
  packages: (z.infer<typeof packageInputSchema> & { id: string })[];
  extras: (z.infer<typeof extraInputSchema> & { id: string })[];
  faqs: (z.infer<typeof faqInputSchema> & { id: string })[];
  images: { fileId: string; url: string | null }[];
  publishedAt: string | null;
  updatedAt: string;
}

export interface ServicePageView {
  items: ServiceCardView[];
  nextCursor: string | null;
}

export interface SavedSearchView {
  id: string;
  name: string;
  query: Omit<ServiceSearchQuery, 'cursor' | 'limit'>;
  createdAt: string;
}
