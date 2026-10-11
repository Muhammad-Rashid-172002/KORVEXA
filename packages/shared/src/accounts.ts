import { z } from 'zod';
import { ACTIVE_MODES, ORG_KINDS, ORG_ROLES, SELLER_AVAILABILITY } from './enums';

const trimmed = (max: number) => z.string().trim().max(max);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/, '3-40 chars: letters, digits, hyphens');

export const setModeSchema = z.object({ mode: z.enum(ACTIVE_MODES) });
export type SetModeInput = z.infer<typeof setModeSchema>;

export const updateProfileSchema = z
  .object({
    displayName: trimmed(80).min(1),
    headline: trimmed(120).nullable(),
    bio: trimmed(2000).nullable(),
    country: trimmed(2).nullable(),
    timezone: trimmed(60).nullable(),
    languages: z.array(trimmed(30).min(1)).max(10),
    slug: slugSchema.nullable(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const setAvatarSchema = z.object({ fileId: z.uuid().nullable() });

export const updateSellerSchema = z
  .object({
    availability: z.enum(SELLER_AVAILABILITY),
    hourlyRateAmount: z.number().int().min(0).max(100_000_00).nullable(),
    rateCurrency: z.string().length(3).toUpperCase(),
    yearsExperience: z.number().int().min(0).max(60).nullable(),
    payoutPreference: trimmed(200).nullable(),
  })
  .partial();
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;

export const setSkillsSchema = z.object({ skills: z.array(trimmed(40).min(1)).max(30) });
export type SetSkillsInput = z.infer<typeof setSkillsSchema>;

const httpUrl = z
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), 'must be http(s)');

export const portfolioItemInputSchema = z.object({
  title: trimmed(120).min(1),
  description: trimmed(1000).nullable().optional(),
  url: httpUrl.nullable().optional(),
  imageFileId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type PortfolioItemInput = z.infer<typeof portfolioItemInputSchema>;

export const createOrgSchema = z.object({ name: trimmed(80).min(2), kind: z.enum(ORG_KINDS) });
export const inviteSchema = z.object({
  email: z.email().toLowerCase(),
  role: z.enum(ORG_ROLES).exclude(['owner']).default('member'),
});
export const acceptInviteSchema = z.object({ token: z.string().min(20).max(200) });
export const updateMemberRoleSchema = z.object({ role: z.enum(ORG_ROLES).exclude(['owner']) });

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const adminScopesSchema = z.object({
  scopes: z.array(z.enum(['product', 'growth', 'operations'])).max(3),
});
export const adminAuditQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(60).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Response shapes shared by API and web. */
export interface PortfolioItemView {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  sortOrder: number;
}

export interface SellerView {
  availability: (typeof SELLER_AVAILABILITY)[number];
  hourlyRateAmount: number | null;
  rateCurrency: string;
  yearsExperience: number | null;
  payoutPreference: string | null;
  onboardingCompleted: boolean;
  skills: { slug: string; name: string }[];
  portfolio: PortfolioItemView[];
}

export interface ProfileView {
  userId: string;
  displayName: string;
  slug: string | null;
  headline: string | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  languages: string[];
  avatarUrl: string | null;
  seller: SellerView | null;
}

export interface OnboardingStatus {
  steps: Record<'profile' | 'skills' | 'portfolio' | 'rates' | 'payout' | 'identity', boolean>;
  /** Steps required before the seller profile is published. */
  required: ('profile' | 'skills' | 'rates')[];
  complete: boolean;
}

export interface OrgView {
  id: string;
  name: string;
  kind: (typeof ORG_KINDS)[number];
  myRole: (typeof ORG_ROLES)[number];
  myUserId: string;
  members: { userId: string; name: string; email: string; role: (typeof ORG_ROLES)[number] }[];
  invites: { id: string; email: string; role: (typeof ORG_ROLES)[number]; expiresAt: string }[];
}

export interface SessionView {
  id: string;
  current: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}
