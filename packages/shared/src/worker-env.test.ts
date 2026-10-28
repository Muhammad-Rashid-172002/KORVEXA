import { describe, expect, it } from 'vitest';
import { workerEnvSchema } from './env';

describe('worker env in production', () => {
  const base = { REDIS_URL: 'redis://x' };
  it('accepts development defaults', () => {
    expect(workerEnvSchema.safeParse(base).success).toBe(true);
  });
  it('refuses the local mail catcher, unscanned uploads and the dev internal token', () => {
    const r = workerEnvSchema.safeParse({ ...base, NODE_ENV: 'production' });
    const m = r.success ? '' : r.error.issues.map((i) => i.path.join('.')).join();
    expect(m).toMatch(/RESEND_API_KEY/);
    expect(m).toMatch(/SCAN_MODE/);
    expect(m).toMatch(/INTERNAL_API_TOKEN/);
  });
  it('accepts a complete production config', () => {
    expect(
      workerEnvSchema.safeParse({
        ...base,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_x',
        SCAN_MODE: 'clamav',
        INTERNAL_API_TOKEN: 'a-real-random-token-with-24-plus-chars',
      }).success,
    ).toBe(true);
  });
});
