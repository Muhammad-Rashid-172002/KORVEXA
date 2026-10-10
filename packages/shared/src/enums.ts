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
