import { ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/** Constant-time check of the worker→API shared secret. */
export function requireInternalToken(provided: string | undefined, expected: string): void {
  const a = Buffer.from(provided ?? '');
  const b = Buffer.from(expected);
  if (!provided || a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException();
}
