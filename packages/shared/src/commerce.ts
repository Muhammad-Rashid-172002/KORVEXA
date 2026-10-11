import { z } from 'zod';
import type { FeeQuote } from './money';
import type { HealthState, MilestoneStatus, ProjectStatus } from './enums';

export const createOrderSchema = z.object({
  packageId: z.uuid(),
  extraIds: z.array(z.uuid()).max(10).default([]),
  /** Answers aligned by index with the service's requirements form. */
  answers: z.array(z.string().trim().max(5000)).max(10).default([]),
  notes: z.string().trim().max(5000).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const submitMilestoneSchema = z.object({ note: z.string().trim().max(2000).optional() });
export const revisionSchema = z.object({ note: z.string().trim().min(5).max(2000) });
export const reasonSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const payoutRequestSchema = z.object({ amount: z.number().int().min(1).optional() });
export const payoutDecisionSchema = z.object({
  reference: z.string().trim().min(2).max(200).optional(),
  note: z.string().trim().max(500).optional(),
});
export const feeSettingsSchema = z.object({
  buyerServiceBps: z.number().int().min(0).max(10_000),
  buyerServiceMin: z.number().int().min(0).max(1_000_000),
  sellerCommissionBps: z.number().int().min(0).max(10_000),
  sellerCommissionMin: z.number().int().min(0).max(1_000_000),
  autoApproveDays: z.number().int().min(1).max(30),
});

export const MIN_PAYOUT_AMOUNT = 2_000; // $20.00

export type MilestoneAction = 'fund' | 'start' | 'submit' | 'request_revision' | 'approve';

export interface MilestoneView {
  id: string;
  position: number;
  title: string;
  acceptanceCriteria: string | null;
  amount: number;
  currency: string;
  status: MilestoneStatus;
  plannedDue: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  autoApproveAt: string | null;
  revisionCount: number;
  submissionNote: string | null;
  revisionNote: string | null;
  /** Fee breakdown the buyer sees before paying this milestone. */
  quote: FeeQuote;
  payment: { id: string; status: string; checkoutUrl: string | null } | null;
  /** What the viewer may do right now (server-computed). */
  actions: MilestoneAction[];
}

export interface ProjectView {
  id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  health: HealthState;
  healthReason: string | null;
  totalAmount: number;
  currency: string;
  /** Weighted by milestone amount, 0–100. */
  progress: number;
  myRole: 'buyer' | 'seller';
  buyer: { id: string; name: string };
  seller: { id: string; name: string; slug: string | null };
  service: { slug: string; title: string } | null;
  escrow: { held: number; released: number };
  requirements: { answers: { question: string; answer: string }[]; notes?: string };
  milestones: MilestoneView[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  canAccept: boolean;
  canDecline: boolean;
}

export interface ProjectListItem {
  id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  progress: number;
  totalAmount: number;
  currency: string;
  myRole: 'buyer' | 'seller';
  counterparty: string;
  createdAt: string;
}

export interface EarningsView {
  currency: string;
  /** Released to the seller and not yet requested for payout. */
  available: number;
  /** Funded and held for milestones the seller is working on. */
  inEscrow: number;
  /** Requested or processing payouts. */
  pendingPayout: number;
  paidOut: number;
  minPayout: number;
  payoutRails: { rail: string; available: boolean; note: string }[];
  transfers: {
    id: string;
    project: string;
    milestone: string;
    gross: number;
    fee: number;
    net: number;
    createdAt: string;
  }[];
  payouts: {
    id: string;
    amount: number;
    status: string;
    rail: string;
    createdAt: string;
    providerRef: string | null;
  }[];
}

export interface InvoiceView {
  id: string;
  number: string;
  totalAmount: number;
  currency: string;
  issuedAt: string;
  lineItems: { description: string; amount: number }[];
}

// ---- buyer requests board & proposals ------------------------------------------------

export const briefInputSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().min(30).max(5000),
    /** Minor units. Estimates only: shown to sellers as the buyer's budget range. */
    budgetMinAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
    budgetMaxAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
  })
  .refine(
    (v) => v.budgetMinAmount == null || v.budgetMaxAmount == null || v.budgetMinAmount <= v.budgetMaxAmount,
    {
      message: 'Minimum budget cannot exceed the maximum',
      path: ['budgetMaxAmount'],
    },
  );
export type BriefInput = z.infer<typeof briefInputSchema>;

export const proposalMilestoneSchema = z.object({
  title: z.string().trim().min(2).max(100),
  acceptanceCriteria: z.string().trim().max(1000).nullable().optional(),
  amount: z.number().int().min(500).max(10_000_000),
  days: z.number().int().min(1).max(180),
});

export const proposalInputSchema = z.object({
  coverLetter: z.string().trim().min(20).max(3000),
  milestonePlan: z.array(proposalMilestoneSchema).min(1).max(10),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;

export const briefListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface ProposalView {
  id: string;
  briefId: string;
  briefTitle: string;
  seller: { id: string; name: string; slug: string | null };
  coverLetter: string;
  milestonePlan: z.infer<typeof proposalMilestoneSchema>[];
  totalAmount: number;
  currency: string;
  status: 'sent' | 'withdrawn' | 'accepted' | 'declined';
  projectId: string | null;
  createdAt: string;
}

export interface BriefView {
  id: string;
  title: string;
  description: string;
  budgetMinAmount: number | null;
  budgetMaxAmount: number | null;
  currency: string;
  status: 'draft' | 'open' | 'closed';
  buyer: { id: string; name: string };
  proposalCount: number;
  isOwner: boolean;
  /** Owner only. */
  proposals: ProposalView[] | null;
  /** Seller's own active proposal on this brief. */
  myProposal: ProposalView | null;
  createdAt: string;
}
