import { eq, users, type DbClient } from '@glasswork/db';
import { QUEUES, type EmailJob } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { createApp } from '../src/bootstrap';
import { DB } from '../src/infra/tokens';

export const ORIGIN = { origin: 'http://localhost:3000' };

export async function createTestApp(): Promise<NestFastifyApplication> {
  // abortOnError:false so DI/boot failures surface as a normal test error instead of killing the worker silently.
  const app = await createApp({ logger: false, abortOnError: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${++counter}@example.test`;

/** Extracts the session cookie pair(s) from a Set-Cookie header for reuse in later requests. */
export function cookieHeader(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** Creates a verified user through the real sign-up endpoint and returns a signed-in cookie. */
export async function signUpVerified(
  app: NestFastifyApplication,
  opts: { email?: string; password?: string; name?: string } = {},
): Promise<{ email: string; userId: string; cookie: string }> {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? 'correct-horse-battery';
  const signUp = await app.inject({
    method: 'POST',
    url: '/v1/auth/sign-up/email',
    headers: ORIGIN,
    payload: { name: opts.name ?? 'Test User', email, password },
  });
  if (signUp.statusCode !== 200) throw new Error(`sign-up failed: ${signUp.statusCode} ${signUp.body}`);
  const userId = (signUp.json() as { user: { id: string } }).user.id;

  const { db } = app.get<DbClient>(DB);
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

  const signIn = await app.inject({
    method: 'POST',
    url: '/v1/auth/sign-in/email',
    headers: ORIGIN,
    payload: { email, password },
  });
  if (signIn.statusCode !== 200) throw new Error(`sign-in failed: ${signIn.statusCode} ${signIn.body}`);
  return { email, userId, cookie: cookieHeader(signIn.headers['set-cookie']) };
}

/** Reads queued email jobs (the worker isn't running in integration tests). */
export async function findEmailJob(
  to: string,
  template: EmailJob['template'],
): Promise<EmailJob | undefined> {
  const queue = new Queue<EmailJob>(QUEUES.email, { connection: { url: process.env.REDIS_URL! } });
  try {
    const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed', 'prioritized']);
    return jobs
      .map((j) => j.data)
      .reverse()
      .find((d) => d.to === to && d.template === template);
  } finally {
    await queue.close();
  }
}

export type TestUser = Awaited<ReturnType<typeof signUpVerified>>;
export type Verb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Builds a `call(user, method, url, payload, headers)` helper bound to an app (URLs are relative to /v1). */
export function makeCaller(app: NestFastifyApplication) {
  return (
    u: TestUser | null,
    method: Verb,
    url: string,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/v1${url}`,
      headers: { ...ORIGIN, ...(u && { cookie: u.cookie }), ...headers },
      ...(payload !== undefined && { payload: payload as object }),
    });
}

/** Opts a user into selling and publishes the seller profile through the real endpoints. */
export async function publishSeller(call: ReturnType<typeof makeCaller>, u: TestUser) {
  await call(u, 'POST', '/me/seller');
  await call(u, 'PATCH', '/me/profile', { headline: 'Engineer', bio: 'Builds things', country: 'PK' });
  await call(u, 'PUT', '/me/seller/skills', { skills: ['React'] });
  await call(u, 'PATCH', '/me/seller', { hourlyRateAmount: 4000 });
  const r = await call(u, 'POST', '/me/seller/onboarding/complete');
  if (r.statusCode !== 201) throw new Error(`publishSeller failed: ${r.statusCode} ${r.body}`);
}

/** Grants admin role + scopes directly in the DB (tests only). */
export async function makeAdmin(
  app: NestFastifyApplication,
  u: TestUser,
  scopes: ('product' | 'growth' | 'operations')[],
) {
  const { db } = app.get<DbClient>(DB);
  await db
    .update(users)
    .set({ roles: ['buyer', 'admin'], adminScopes: scopes })
    .where(eq(users.id, u.userId));
}

let keyCounter = 0;
export const idemKey = (p = 'k') => `${p}-${Date.now()}-${++keyCounter}-test`;
