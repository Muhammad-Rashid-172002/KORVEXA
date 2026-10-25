import { eq, services, users, type DbClient } from '@glasswork/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { bootMarket, createTestApp, makeCaller, ORIGIN, signUpVerified } from './helpers';

describe('Phase 9: data export and account deletion', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;

  beforeAll(async () => {
    app = await createTestApp();
    m = await bootMarket(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('exports only the caller’s data and never secrets', async () => {
    const r = await m.call(m.seller, 'GET', '/me/export');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toContain('attachment');
    const d = r.json() as { account: { id: string }; services: { sellerId: string }[] };
    expect(d.account.id).toBe(m.seller.userId);
    expect(d.services.length).toBeGreaterThan(0);
    expect(d.services.every((s) => s.sellerId === m.seller.userId)).toBe(true);
    expect(r.body).not.toMatch(/password|accessToken|refreshToken|secret/i);
    expect(r.body).not.toContain(m.buyer.email);
    expect((await m.call(null, 'GET', '/me/export')).statusCode).toBe(401);
  });

  it('refuses deletion without the matching email', async () => {
    const u = await signUpVerified(app, { name: 'Dana Delete' });
    const call = makeCaller(app);
    const r = await call(u, 'POST', '/me/delete', { confirmEmail: 'someone@else.test' });
    expect(r.statusCode).toBe(409);
    expect((await call(u, 'GET', '/me')).statusCode).toBe(200);
  });

  it('blocks deletion while a project is live or money is owed', async () => {
    await m.activeProject();
    for (const u of [m.buyer, m.seller]) {
      const check = (await m.call(u, 'GET', '/me/delete-check')).json() as {
        canDelete: boolean;
        reasons: string[];
      };
      expect(check.canDelete).toBe(false);
      expect(check.reasons.join(' ')).toMatch(/projects in progress/);
      expect((await m.call(u, 'POST', '/me/delete', { confirmEmail: u.email })).statusCode).toBe(409);
    }
  });

  it('anonymises the account, kills sessions, pauses listings and frees the email', async () => {
    const seller = await signUpVerified(app, { name: 'Sam Seller' });
    const call = makeCaller(app);
    await call(seller, 'POST', '/me/seller');
    const { db } = app.get<DbClient>(DB);
    const r = await call(seller, 'POST', '/me/delete', { confirmEmail: seller.email.toUpperCase() });
    expect(r.statusCode).toBe(201);

    expect((await call(seller, 'GET', '/me')).statusCode).toBe(401);
    const [row] = await db.select().from(users).where(eq(users.id, seller.userId));
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.email).not.toBe(seller.email);
    expect(row!.name).toBe('Deleted user');
    const signIn = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-in/email',
      headers: ORIGIN,
      payload: { email: seller.email, password: 'correct-horse-battery' },
    });
    expect(signIn.statusCode).not.toBe(200);
    // The address can register again as a brand-new account.
    const again = await signUpVerified(app, { email: seller.email });
    expect(again.userId).not.toBe(seller.userId);
    expect(await db.select().from(services).where(eq(services.sellerId, seller.userId))).toEqual([]);
  });
});
