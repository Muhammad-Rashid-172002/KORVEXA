import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@glasswork/shared';

export const IS_PUBLIC = 'gw:isPublic';
export const POLICY = 'gw:policy';

export interface PolicyMeta {
  /** Required global roles (any of). Empty = any authenticated user. */
  roles: readonly UserRole[];
  /** Human-readable description of the resource-level rule enforced in the service layer. */
  rule: string;
}

/** Endpoint is reachable without a session. Use sparingly. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Endpoint requires a session; `rule` documents the ownership/membership check the service enforces
 * via scoped repositories. Every route must declare @Public() or @Policy() — enforced at boot.
 */
export const Policy = (rule: string, roles: readonly UserRole[] = []) =>
  SetMetadata(POLICY, { roles, rule } satisfies PolicyMeta);
