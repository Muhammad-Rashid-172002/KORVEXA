import {
  ACTIVE_MODES,
  ADMIN_SCOPES,
  FILE_PURPOSES,
  BRIEF_STATUSES,
  CONVERSATION_KINDS,
  DELIVERABLE_STATUSES,
  ESCROW_STATUSES,
  FILE_STATUSES,
  HEALTH_STATES,
  LEDGER_ACCOUNT_TYPES,
  MESSAGE_KINDS,
  MILESTONE_STATUSES,
  OFFER_STATUSES,
  ORG_KINDS,
  ORG_ROLES,
  PACKAGE_TIERS,
  PARTICIPANT_ROLES,
  PAYMENT_STATUSES,
  PAYOUT_RAILS,
  PAYOUT_STATUSES,
  PREVIEW_KINDS,
  PROJECT_STATUSES,
  PROPOSAL_STATUSES,
  SERVICE_STATUSES,
  TASK_SOURCES,
  TASK_STATUSES,
  TRANSFER_STATUSES,
  SELLER_AVAILABILITY,
  USER_ROLES,
} from '@glasswork/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

// Postgres enums are created from the shared TS lists so API, DB and web never drift.
export const userRole = pgEnum('user_role', USER_ROLES);
export const adminScope = pgEnum('admin_scope', ADMIN_SCOPES);
export const activeMode = pgEnum('active_mode', ACTIVE_MODES);
export const filePurpose = pgEnum('file_purpose', FILE_PURPOSES);
export const fileStatus = pgEnum('file_status', FILE_STATUSES);
export const orgKind = pgEnum('org_kind', ORG_KINDS);
export const orgRole = pgEnum('org_role', ORG_ROLES);
export const sellerAvailability = pgEnum('seller_availability', SELLER_AVAILABILITY);
export const serviceStatus = pgEnum('service_status', SERVICE_STATUSES);
export const packageTier = pgEnum('package_tier', PACKAGE_TIERS);
export const projectStatus = pgEnum('project_status', PROJECT_STATUSES);
export const milestoneStatus = pgEnum('milestone_status', MILESTONE_STATUSES);
export const healthState = pgEnum('health_state', HEALTH_STATES);
export const participantRole = pgEnum('participant_role', PARTICIPANT_ROLES);
export const paymentStatus = pgEnum('payment_status', PAYMENT_STATUSES);
export const escrowStatus = pgEnum('escrow_status', ESCROW_STATUSES);
export const transferStatus = pgEnum('transfer_status', TRANSFER_STATUSES);
export const payoutStatus = pgEnum('payout_status', PAYOUT_STATUSES);
export const payoutRail = pgEnum('payout_rail', PAYOUT_RAILS);
export const ledgerAccountType = pgEnum('ledger_account_type', LEDGER_ACCOUNT_TYPES);
export const briefStatus = pgEnum('brief_status', BRIEF_STATUSES);
export const proposalStatus = pgEnum('proposal_status', PROPOSAL_STATUSES);
export const taskStatus = pgEnum('task_status', TASK_STATUSES);
export const taskSource = pgEnum('task_source', TASK_SOURCES);
export const previewKind = pgEnum('preview_kind', PREVIEW_KINDS);
export const deliverableStatus = pgEnum('deliverable_status', DELIVERABLE_STATUSES);
export const conversationKind = pgEnum('conversation_kind', CONVERSATION_KINDS);
export const messageKind = pgEnum('message_kind', MESSAGE_KINDS);
export const offerStatus = pgEnum('offer_status', OFFER_STATUSES);
