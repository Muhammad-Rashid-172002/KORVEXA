import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../src/config/env';
import { createTestApp, ORIGIN } from './helpers';

describe('auth rate limiting', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_ENABLED = 'true';
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    resetEnvCache();
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.AUTH_RATE_LIMIT_ENABLED = 'false';
    resetEnvCache();
  });

  it('blocks repeated sign-in attempts from the same IP with 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in/email',
        headers: ORIGIN,
        remoteAddress: '203.0.113.7',
        payload: { email: 'brute@example.test', password: 'wrong-password-x' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
