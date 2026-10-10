import { eq, users, type DbClient } from '@glasswork/db';
import { QUEUES, type EmailJob } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { createApp } from '../src/bootstrap';
import { DB } from '../src/infra/tokens';

export const ORIGIN = { origin: 'http://localhost:3000' };

export async function createTestApp(): Promise<NestFastifyApplication> {
  const app = await createApp({ logger: false });
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
export async function findEmailJob(to: string, template: EmailJob['template']): Promise<EmailJob | undefined> {
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
