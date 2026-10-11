import { z } from 'zod';

export const AI_FEATURES = ['brief_builder', 'matching', 'progress_report', 'meeting_notes'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** USD per million tokens. Numerically equal to micro-USD per token, so cost stays in integers. */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}
const PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
/** Unknown models are priced like the most expensive known one, so a typo can never under-count spend. */
const FALLBACK_PRICE: ModelPrice = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Cost in micro-USD (1 USD = 1,000,000), rounded up so spend is never under-counted. */
export function costMicros(model: string, u: TokenUsage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return Math.ceil(
    u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite,
  );
}
export const centsToMicros = (cents: number) => cents * 10_000;

// ---- brief builder ---------------------------------------------------------------------

export const briefSessionStartSchema = z.object({
  idea: z.string().trim().min(20, 'Describe your idea in at least a couple of sentences').max(3000),
});
export const briefSessionAnswersSchema = z.object({
  answers: z
    .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().max(1500) }))
    .min(1)
    .max(6),
});

/** The structured brief. Budget and timeline are estimates and are always labelled that way in the UI. */
export const structuredBriefSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(1200),
  goals: z.array(z.string().max(300)).max(8),
  userStories: z.array(z.string().max(300)).max(12),
  platforms: z.array(z.string().max(60)).max(8),
  integrations: z.array(z.string().max(80)).max(10),
  suggestedMilestones: z
    .array(z.object({ title: z.string().max(100), description: z.string().max(400) }))
    .max(8),
  estimate: z.object({
    budgetMinUsd: z.number().int().min(0).max(1_000_000),
    budgetMaxUsd: z.number().int().min(0).max(1_000_000),
    timelineWeeksMin: z.number().int().min(1).max(104),
    timelineWeeksMax: z.number().int().min(1).max(104),
  }),
  openQuestions: z.array(z.string().max(300)).max(6),
});
export type StructuredBrief = z.infer<typeof structuredBriefSchema>;

export const clarifyingQuestionsSchema = z.object({
  questions: z.array(z.string().max(300)).min(1).max(5),
});

export interface BriefSessionView {
  id: string;
  status: 'asking' | 'ready' | 'posted';
  idea: string;
  questions: string[];
  brief: StructuredBrief | null;
  postedBriefId: string | null;
  createdAt: string;
}

// ---- matching -----------------------------------------------------------------------------

export const matchRequestSchema = z.object({
  /** Either an existing request of yours, or free text. */
  briefId: z.uuid().optional(),
  text: z.string().trim().min(20).max(3000).optional(),
  budgetMaxUsd: z.number().int().min(1).max(1_000_000).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});
export type MatchRequest = z.infer<typeof matchRequestSchema>;

export interface MatchFactors {
  skills: { matched: string[]; score: number };
  rating: { average: number | null; count: number; score: number };
  verified: { labels: string[]; score: number };
  responseHours: { median: number | null; score: number };
  availability: { value: string; score: number };
  budget: { fit: 'within' | 'over' | 'unknown'; score: number };
}
export interface MatchView {
  seller: { id: string; name: string; slug: string; headline: string | null };
  score: number;
  factors: MatchFactors;
  /** Written by the AI from `factors` only; falls back to a plain-language summary of the same data. */
  explanation: string;
  explainedBy: 'ai' | 'rules';
}

export const MATCH_WEIGHTS = {
  skills: 0.35,
  rating: 0.2,
  verified: 0.1,
  responseHours: 0.1,
  availability: 0.1,
  budget: 0.15,
} as const;

// ---- progress reports -----------------------------------------------------------------

export const reportContentSchema = z.object({
  summary: z.string().max(1500),
  done: z.array(z.string().max(300)).max(15),
  next: z.array(z.string().max(300)).max(15),
  risks: z.array(z.string().max(300)).max(10),
  decisionsNeeded: z.array(z.string().max(300)).max(10),
});
export type ReportContent = z.infer<typeof reportContentSchema>;

export const generateReportSchema = z.object({
  days: z.number().int().min(1).max(60).default(7),
});
export const editReportSchema = z.object({ content: reportContentSchema });

export interface ProgressReportView {
  id: string;
  projectId: string;
  kind: 'weekly' | 'on_demand';
  status: 'draft' | 'sent';
  periodStart: string;
  periodEnd: string;
  content: ReportContent;
  /** True once the seller changed the AI draft. */
  edited: boolean;
  generatedBy: 'ai' | 'rules';
  sentAt: string | null;
  createdAt: string;
}

// ---- meeting notes -> tasks -------------------------------------------------------------

export const meetingNotesSchema = z.object({
  notes: z.string().trim().min(30, 'Paste at least a few sentences of notes').max(20_000),
  milestoneId: z.uuid().nullable().optional(),
});
export const proposedTasksSchema = z.object({
  tasks: z.array(z.object({ title: z.string().max(140), description: z.string().max(600) })).max(20),
});
export const confirmTasksSchema = z.object({
  milestoneId: z.uuid().nullable().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(140),
        description: z.string().trim().max(600).default(''),
      }),
    )
    .min(1)
    .max(20),
});
export type ProposedTasks = z.infer<typeof proposedTasksSchema>;

// ---- seller analytics (real data only) --------------------------------------------------

export interface SellerAnalyticsView {
  periodDays: number;
  currency: string;
  earnings: { total: number; last30Days: number; pendingInEscrow: number };
  proposals: { sent: number; accepted: number; conversionRate: number | null };
  responseHours: { median: number | null; sampleSize: number };
  onTime: { rate: number | null; sampleSize: number };
  repeatBuyers: { rate: number | null; buyers: number; repeat: number };
  completedProjects: number;
  rating: { average: number | null; count: number };
  /** Honest labelling for empty states. */
  hasData: boolean;
}

export interface AiStatusView {
  enabled: boolean;
  provider: 'stub' | 'anthropic' | 'off';
  /** Remaining budget today for the caller, in cents (never exposes platform totals). */
  remainingTodayCents: number;
}
