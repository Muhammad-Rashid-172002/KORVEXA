import { z } from 'zod';
import type { VerificationKind, VerificationStatus } from './enums';
import { REPORT_TARGETS, VERIFICATION_KINDS } from './enums';

const rating = z.number().int().min(1).max(5);

export const finalReviewSchema = z.object({
  ratingOverall: rating,
  ratingCommunication: rating,
  ratingQuality: rating,
  ratingTimeliness: rating,
  body: z.string().trim().max(3000).default(''),
});
export type FinalReviewInput = z.infer<typeof finalReviewSchema>;

export const milestoneFeedbackSchema = z.object({ rating, body: z.string().trim().max(2000).default('') });
export const reviewReplySchema = z.object({ body: z.string().trim().min(2).max(2000) });
export const reviewsQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ---- seller levels ---------------------------------------------------------------------------

export interface SellerStats {
  completedProjects: number;
  /** Public final reviews only. */
  reviewCount: number;
  avgRating: number | null;
  /** 0–1 share of released milestones submitted on or before the planned date; null until there is data. */
  onTimeRate: number | null;
}

export const SELLER_LEVELS = [
  {
    key: 'new',
    label: 'New seller',
    criteria: { completedProjects: 0, reviewCount: 0, avgRating: 0, onTimeRate: 0 },
  },
  {
    key: 'level_1',
    label: 'Level 1',
    criteria: { completedProjects: 3, reviewCount: 3, avgRating: 4.0, onTimeRate: 0.8 },
  },
  {
    key: 'level_2',
    label: 'Level 2',
    criteria: { completedProjects: 10, reviewCount: 8, avgRating: 4.5, onTimeRate: 0.9 },
  },
  {
    key: 'top_rated',
    label: 'Top rated',
    criteria: { completedProjects: 25, reviewCount: 20, avgRating: 4.7, onTimeRate: 0.95 },
  },
] as const;
export type SellerLevelKey = (typeof SELLER_LEVELS)[number]['key'];
export const SELLER_LEVEL_KEYS = SELLER_LEVELS.map((l) => l.key) as unknown as readonly [
  SellerLevelKey,
  ...SellerLevelKey[],
];

export const meetsCriteria = (s: SellerStats, c: (typeof SELLER_LEVELS)[number]['criteria']): boolean =>
  s.completedProjects >= c.completedProjects &&
  s.reviewCount >= c.reviewCount &&
  (c.reviewCount === 0 || (s.avgRating ?? 0) >= c.avgRating) &&
  (c.completedProjects === 0 || (s.onTimeRate ?? 0) >= c.onTimeRate);

/** Highest level whose published criteria are ALL met by real metrics. No manual overrides. */
export function computeSellerLevel(s: SellerStats): SellerLevelKey {
  let level: SellerLevelKey = 'new';
  for (const l of SELLER_LEVELS) if (meetsCriteria(s, l.criteria)) level = l.key;
  return level;
}

/** What is still missing for the next level (drives the seller's progress card). */
export function nextLevelGap(s: SellerStats): { next: SellerLevelKey; missing: string[] } | null {
  const current = computeSellerLevel(s);
  const idx = SELLER_LEVELS.findIndex((l) => l.key === current);
  const next = SELLER_LEVELS[idx + 1];
  if (!next) return null;
  const c = next.criteria;
  const missing: string[] = [];
  if (s.completedProjects < c.completedProjects)
    missing.push(`${c.completedProjects - s.completedProjects} more completed project(s)`);
  if (s.reviewCount < c.reviewCount) missing.push(`${c.reviewCount - s.reviewCount} more public review(s)`);
  if ((s.avgRating ?? 0) < c.avgRating) missing.push(`average rating of ${c.avgRating.toFixed(1)} or higher`);
  if ((s.onTimeRate ?? 0) < c.onTimeRate) missing.push(`${Math.round(c.onTimeRate * 100)}% on-time delivery`);
  return { next: next.key, missing };
}

// ---- verifications ---------------------------------------------------------------------------

export const VERIFICATION_LABELS: Record<VerificationKind, string> = {
  identity: 'Identity verified',
  github: 'GitHub connected',
  play_store: 'Play Store developer link verified',
  app_store: 'App Store developer link verified',
  portfolio: 'Portfolio reviewed',
  skill_test: 'Skill test passed',
};

export const verificationRequestSchema = z.object({
  kind: z.enum(VERIFICATION_KINDS),
  /** Public profile / listing / portfolio URL (https). */
  url: z
    .url()
    .max(500)
    .refine((u) => /^https:\/\//i.test(u), 'Must be https')
    .optional(),
  handle: z.string().trim().max(100).optional(),
  note: z.string().trim().max(1000).optional(),
  evidenceFileId: z.uuid().optional(),
});
export const verificationDecisionSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

export interface VerificationView {
  id: string;
  kind: VerificationKind;
  label: string;
  status: VerificationStatus;
  /** True when the platform itself can prove it (e.g. a linked GitHub account), without an admin review. */
  automatic: boolean;
  reviewNote: string | null;
  createdAt: string;
}

// ---- reports -----------------------------------------------------------------------------------

export const reportInputSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.uuid(),
  reason: z.string().trim().min(3).max(100),
  details: z.string().trim().max(2000).optional(),
});
export const reportDecisionSchema = z.object({
  decision: z.enum(['actioned', 'dismissed']),
  note: z.string().trim().min(2).max(500),
});

// ---- views -------------------------------------------------------------------------------------

export interface ReviewView {
  id: string;
  author: { name: string };
  ratingOverall: number;
  ratingCommunication: number | null;
  ratingQuality: number | null;
  ratingTimeliness: number | null;
  body: string;
  projectTitle: string;
  createdAt: string;
  reply: { body: string; createdAt: string } | null;
}

export interface SellerStatsView extends SellerStats {
  level: SellerLevelKey;
  levelLabel: string;
  subRatings: { communication: number | null; quality: number | null; timeliness: number | null };
}

// ---- change requests --------------------------------------------------------------------------

export const changeRequestInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(3000),
    /** Days added to every still-open milestone's planned date. */
    daysDelta: z.number().int().min(0).max(90).default(0),
    /** New milestones created on acceptance; their sum is the price impact. */
    milestones: z
      .array(
        z.object({
          title: z.string().trim().min(2).max(100),
          acceptanceCriteria: z.string().trim().max(1000).nullable().optional(),
          amount: z.number().int().min(500).max(10_000_000),
          days: z.number().int().min(1).max(180),
        }),
      )
      .max(5)
      .default([]),
  })
  .refine((v) => v.milestones.length > 0 || v.daysDelta > 0, {
    message: 'A change must add work (milestones) or time (days)',
    path: ['milestones'],
  });
export type ChangeRequestInput = z.infer<typeof changeRequestInputSchema>;

export interface ChangeRequestView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priceDeltaAmount: number;
  daysDelta: number;
  milestones: { title: string; amount: number; days: number }[];
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  requestedBy: { id: string; name: string };
  /** True when the viewer is the other party and may accept/decline. */
  canRespond: boolean;
  canWithdraw: boolean;
  createdAt: string;
}

// ---- disputes ----------------------------------------------------------------------------------

export const openDisputeSchema = z.object({ reason: z.string().trim().min(20).max(3000) });
export const evidenceInputSchema = z
  .object({
    kind: z.enum(['note', 'upload', 'message', 'deliverable']).default('note'),
    note: z.string().trim().max(3000).optional(),
    fileId: z.uuid().optional(),
    refId: z.uuid().optional(),
  })
  .refine((v) => Boolean(v.note || v.fileId || v.refId), { message: 'Add a note, a file or a reference' });
export const resolveDisputeSchema = z.object({
  outcome: z.enum(['release', 'refund', 'split']),
  /** Minor units returned to the buyer on a split. */
  refundAmount: z.number().int().min(1).optional(),
  note: z.string().trim().min(10).max(2000),
});
export const adminDisputesQuerySchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved']).default('open'),
});

export interface DisputeView {
  id: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneAmount: number;
  currency: string;
  status: 'open' | 'under_review' | 'resolved';
  outcome: 'release' | 'refund' | 'split' | null;
  refundAmount: number | null;
  reason: string;
  resolutionNote: string | null;
  openedBy: { id: string; name: string };
  createdAt: string;
  resolvedAt: string | null;
  caseFile: Record<string, unknown>;
  evidence: {
    id: string;
    kind: string;
    by: { id: string | null; name: string };
    note: string | null;
    refId: string | null;
    file: { id: string; name: string } | null;
    createdAt: string;
  }[];
}
