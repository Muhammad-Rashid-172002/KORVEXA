import type { UserRole } from '@glasswork/shared';

/**
 * Explicit policy functions (DECISIONS D-011). Resource checks that need data are expressed as
 * scoped repository queries; pure checks live here so they're unit-testable.
 */
export const hasAnyRole = (userRoles: readonly UserRole[], required: readonly UserRole[]) =>
  required.length === 0 || required.some((r) => userRoles.includes(r));

export const canReadFile = (actorId: string, file: { ownerId: string }) => file.ownerId === actorId;
