import { describe, expect, it } from 'vitest';
import { canReadFile, hasAnyRole } from './policies';

describe('policy functions', () => {
  it('hasAnyRole: empty requirement means any authenticated user', () => {
    expect(hasAnyRole(['buyer'], [])).toBe(true);
    expect(hasAnyRole(['buyer'], ['admin'])).toBe(false);
    expect(hasAnyRole(['buyer', 'admin'], ['admin', 'support'])).toBe(true);
  });
  it('canReadFile: only the owner', () => {
    expect(canReadFile('u1', { ownerId: 'u1' })).toBe(true);
    expect(canReadFile('u2', { ownerId: 'u1' })).toBe(false);
  });
});
