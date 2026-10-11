/**
 * Domain enums — single source of truth for API, DB (pgEnum) and web.
 * Values match docs/ERD.md. Tables arrive per phase; enum lists are defined up front.
 */
export const USER_ROLES = ['buyer', 'seller', 'admin', 'support'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Admin scopes are data, assigned per user — never tied to specific people in code (D-003). */
export const ADMIN_SCOPES = ['product', 'growth', 'operations'] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];

export const ACTIVE_MODES = ['buyer', 'seller'] as const;
export type ActiveMode = (typeof ACTIVE_MODES)[number];

export const FILE_PURPOSES = ['avatar', 'portfolio', 'deliverable', 'message', 'evidence'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const FILE_STATUSES = ['pending', 'uploaded', 'clean', 'infected', 'rejected'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const PROJECT_STATUSES = [
  'draft',
  'requirements_submitted',
  'active',
  'completed',
  'reviewed',
  'paused',
  'cancellation_requested',
  'cancelled',
  'disputed',
  'resolved',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MILESTONE_STATUSES = [
  'pending',
  'funded',
  'in_progress',
  'submitted',
  'revision_requested',
  'approved',
  'released',
  'cancelled',
  'refunded',
  'disputed',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const PAYOUT_RAILS = ['stripe_connect', 'stripe_global_payouts', 'payoneer', 'manual_bank'] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export const VERIFICATION_KINDS = [
  'identity',
  'github',
  'play_store',
  'app_store',
  'portfolio',
  'skill_test',
] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const ORG_KINDS = ['buyer_team', 'agency'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const SELLER_AVAILABILITY = ['available', 'busy', 'away'] as const;
export type SellerAvailability = (typeof SELLER_AVAILABILITY)[number];

export const SELLER_ONBOARDING_STEPS = [
  'profile',
  'skills',
  'portfolio',
  'rates',
  'payout',
  'identity',
] as const;
export type SellerOnboardingStep = (typeof SELLER_ONBOARDING_STEPS)[number];

export const SERVICE_STATUSES = ['draft', 'pending_review', 'live', 'paused', 'rejected'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const PACKAGE_TIERS = ['basic', 'standard', 'premium'] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

export const HEALTH_STATES = ['on_track', 'at_risk', 'blocked'] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export const PARTICIPANT_ROLES = [
  'buyer',
  'buyer_member',
  'seller',
  'seller_member',
  'admin_observer',
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ESCROW_STATUSES = ['held', 'released', 'refunded', 'split', 'disputed'] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const TRANSFER_STATUSES = ['pending', 'completed', 'failed', 'reversed'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const PAYOUT_STATUSES = ['requested', 'processing', 'paid', 'failed'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const LEDGER_ACCOUNT_TYPES = ['asset', 'liability', 'revenue', 'expense'] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

export const BRIEF_STATUSES = ['draft', 'open', 'closed'] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const PROPOSAL_STATUSES = ['sent', 'withdrawn', 'accepted', 'declined'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_SOURCES = ['manual', 'meeting_ai'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const PREVIEW_KINDS = ['staging', 'figma', 'apk', 'testflight', 'video', 'other'] as const;
export type PreviewKind = (typeof PREVIEW_KINDS)[number];

export const DELIVERABLE_STATUSES = ['submitted', 'approved', 'revision_requested', 'superseded'] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const CONVERSATION_KINDS = ['direct', 'project'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const MESSAGE_KINDS = ['text', 'custom_offer', 'system'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const OFFER_STATUSES = ['sent', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
