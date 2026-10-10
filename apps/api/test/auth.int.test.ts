import { accounts, auditLogs, eq, type DbClient } from '@glasswork/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { cookieHeader, createTestApp, findEmailJob, ORIGIN, uniqueEmail } from './helpers';

describe('auth end-to-end (register → verify → login → logout)', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('runs the full email + password flow', async () => {
    const email = uniqueEmail('flow');
    const password = 'a-long-enough-password';

    const signUp = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-up/email',
      headers: ORIGIN,
      payload: { name: 'Flow User', email, password, callbackURL: 'http://localhost:3000/dashboard' },
    });
    expect(signUp.statusCode).toBe(200);
    expect(signUp.headers['set-cookie']).toBeUndefined(); // no session before verification

    // Unverified users cannot sign in.
    const early = await app.inject({ method: 'POST', url: '/v1/auth/sign-in/email', headers: ORIGIN, payload: { email, password } });
    expect(early.statusCode).toBe(403);
    expect(early.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    // The verification email was queued for the worker with a link back to the API.
    const job = await findEmailJob(email, 'verify-email');
    expect(job).toBeDefined();
    const link = new URL(job!.data.url);
    expect(link.pathname).toBe('/v1/auth/verify-email');

    // Clicking the link verifies, signs in (cookie) and redirects to the web app.
    const verify = await app.inject({ method: 'GET', url: link.pathname + link.search });
    expect(verify.statusCode).toBe(302);
    expect(verify.headers.location).toBe('http://localhost:3000/dashboard');
    const cookie = cookieHeader(verify.headers['set-cookie']);
    expect(cookie).toContain('gw.session_token=');

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email, emailVerified: true, roles: ['buyer'], activeMode: 'buyer' });

    // Password stored as argon2id, never plaintext.
    const { db } = app.get<DbClient>(DB);
    const [acct] = await db.select().from(accounts).where(eq(accounts.providerId, 'credential'));
    expect(acct?.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

    // Profile + audit log were created by the user.create hook.
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.created'));
    expect(audits.length).toBeGreaterThan(0);

    // Explicit login works too.
    const signIn = await app.inject({ method: 'POST', url: '/v1/auth/sign-in/email', headers: ORIGIN, payload: { email, password } });
    expect(signIn.statusCode).toBe(200);
    const cookie2 = cookieHeader(signIn.headers['set-cookie']);
    const setCookie = ([] as string[]).concat(signIn.headers['set-cookie'] ?? []).join('\n');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    // Logout revokes the session.
    const out = await app.inject({ method: 'POST', url: '/v1/auth/sign-out', headers: { ...ORIGIN, cookie: cookie2 }, payload: {} });
    expect(out.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookie2 } });
    expect(after.statusCode).toBe(401);
    expect(after.json()).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('rejects a wrong password and a short password', async () => {
    const email = uniqueEmail('bad');
    const short = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-up/email',
      headers: ORIGIN,
      payload: { name: 'X', email, password: 'short' },
    });
    expect(short.statusCode).toBe(400);
    const wrong = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-in/email',
      headers: ORIGIN,
      payload: { email: 'nobody@example.test', password: 'whatever-password' },
    });
    expect(wrong.statusCode).toBe(401);
  });

  it('accepts a bearer token for API clients (future Flutter app)', async () => {
    const email = uniqueEmail('bearer');
    const password = 'bearer-password-123';
    await app.inject({ method: 'POST', url: '/v1/auth/sign-up/email', headers: ORIGIN, payload: { name: 'B', email, password } });
    const job = await findEmailJob(email, 'verify-email');
    const link = new URL(job!.data.url);
    await app.inject({ method: 'GET', url: link.pathname + link.search });
    const signIn = await app.inject({ method: 'POST', url: '/v1/auth/sign-in/email', headers: ORIGIN, payload: { email, password } });
    const token = signIn.headers['set-auth-token'];
    expect(typeof token).toBe('string');
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${String(token)}` } });
    expect(me.statusCode).toBe(200);
  });
});
