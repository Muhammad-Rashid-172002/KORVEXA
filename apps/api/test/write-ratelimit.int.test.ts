import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../src/config/env';
import { createTestApp, makeCaller, signUpVerified } from './helpers';

describe('write rate limiting (OWASP A04/A07)', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    process.env.WRITE_RATE_LIMIT_PER_MINUTE = '15';
    resetEnvCache();
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.WRITE_RATE_LIMIT_PER_MINUTE = '10000';
    resetEnvCache();
  });

  it('caps writes per user, independently of other users on the same IP, and leaves reads alone', async () => {
    const call = makeCaller(app);
    const a = await signUpVerified(app);
    const b = await signUpVerified(app);
    const write = (u: typeof a) => call(u, 'PATCH', '/me/profile', { headline: 'x' });
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await write(a)).statusCode);

    expect(statuses.at(-1)).toBe(429);
    expect(statuses[0]).not.toBe(429);
    // user B shares the IP in tests but has an untouched budget
    expect((await write(b)).statusCode).not.toBe(429);
    // reads use a separate, larger budget
    expect((await call(a, 'GET', '/me')).statusCode).toBe(200);
  });
});
