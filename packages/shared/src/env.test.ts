import { describe, expect, it } from 'vitest';
import { apiEnvSchema } from './env';

const base = {
  DATABASE_URL: 'postgres://x',
  REDIS_URL: 'redis://x',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  S3_ENDPOINT: 'http://s3.test',
  S3_PUBLIC_ENDPOINT: 'http://s3.test',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'a',
  S3_SECRET_ACCESS_KEY: 'b',
};
const parse = (extra: Record<string, string>) => apiEnvSchema.safeParse({ ...base, ...extra });
const messages = (extra: Record<string, string>) => {
  const r = parse(extra);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('payment safety rails in the env schema', () => {
  it('defaults to the simulated provider in development', () => {
    const r = parse({});
    expect(r.success && r.data.PAYMENTS_PROVIDER).toBe('test');
    expect(r.success && r.data.PAYMENTS_LIVE_ENABLED).toBe(false);
  });

  it('refuses live Stripe keys unless PAYMENTS_LIVE_ENABLED=true (D-020)', () => {
    const stripe = { PAYMENTS_PROVIDER: 'stripe', STRIPE_WEBHOOK_SECRET: 'whsec_x' };
    expect(messages({ ...stripe, STRIPE_SECRET_KEY: 'sk_live_abc' }).join()).toMatch(
      /live Stripe keys are refused/,
    );
    expect(parse({ ...stripe, STRIPE_SECRET_KEY: 'sk_test_abc' }).success).toBe(true);
    expect(
      parse({ ...stripe, STRIPE_SECRET_KEY: 'sk_live_abc', PAYMENTS_LIVE_ENABLED: 'true' }).success,
    ).toBe(true);
    // Even without selecting the stripe provider, a live key in the environment is refused.
    expect(messages({ STRIPE_SECRET_KEY: 'sk_live_abc' }).join()).toMatch(/live Stripe keys are refused/);
  });

  it('requires both Stripe secrets when the stripe provider is selected', () => {
    const m = messages({ PAYMENTS_PROVIDER: 'stripe' }).join();
    expect(m).toMatch(/STRIPE_SECRET_KEY/);
    expect(m).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it('refuses the simulated provider and the dev internal token in production', () => {
    const m = messages({ NODE_ENV: 'production' }).join();
    expect(m).toMatch(/simulated test provider cannot run in production/);
    expect(m).toMatch(/INTERNAL_API_TOKEN/);
    expect(m).toMatch(/virus-scanned in production/);
    expect(
      parse({
        NODE_ENV: 'production',
        PAYMENTS_PROVIDER: 'stripe',
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        INTERNAL_API_TOKEN: 'a-real-random-token-with-24-plus-chars',
        SCAN_MODE: 'clamav',
        AI_PROVIDER: 'off',
        VIDEO_PROVIDER: 'off',
      }).success,
    ).toBe(true);
  });

  it('AI: the offline stub is refused in production and the anthropic provider needs its key', () => {
    expect(messages({ NODE_ENV: 'production' }).join()).toMatch(/offline stub AI cannot run in production/);
    expect(messages({ AI_PROVIDER: 'anthropic' }).join()).toMatch(/ANTHROPIC_API_KEY/);
    expect(parse({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' }).success).toBe(true);
  });

  it('video: stub is refused in production and daily needs its keys', () => {
    expect(messages({ NODE_ENV: 'production' }).join()).toMatch(
      /stub video provider cannot run in production/,
    );
    expect(messages({ VIDEO_PROVIDER: 'daily' }).join()).toMatch(/DAILY_API_KEY/);
    expect(parse({ VIDEO_PROVIDER: 'daily', DAILY_API_KEY: 'k', DAILY_DOMAIN: 'acme' }).success).toBe(true);
  });
});
