import {
  ACTIVE_MODES,
  ADMIN_SCOPES,
  FILE_PURPOSES,
  FILE_STATUSES,
  ORG_KINDS,
  ORG_ROLES,
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
