import { eq, filesRepository, users, type DbClient } from '@glasswork/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHmac } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { createTestApp, findEmailJob, ORIGIN, signUpVerified } from './helpers';

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret, to drive the real 2FA flow. */
function totp(base32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32.replace(/=+$/, '').toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}

const cookies = (h: string | string[] | undefined) =>
  [h ?? []]
    .flat()
    .map((c) => c.split(';')[0])
    .join('; ');

type U = Awaited<ReturnType<typeof signUpVerified>>;

describe('Phase 1: accounts, sellers, orgs, sessions, admin', () => {
  let app: NestFastifyApplication;
  let alice: U;
  let bob: U;
  let admin: U;

  const call = (
    u: U | null,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url: `/v1${url}`,
      headers: { ...ORIGIN, ...(u && { cookie: u.cookie }) },
      ...(payload !== undefined && { payload: payload as object }),
    });

  beforeAll(async () => {
    app = await createTestApp();
    alice = await signUpVerified(app, { name: 'Alice Builder' });
    bob = await signUpVerified(app, { name: 'Bob Buyer' });
    admin = await signUpVerified(app, { name: 'Ada Admin' });
    const { db } = app.get<DbClient>(DB);
    await db
      .update(users)
      .set({ roles: ['buyer', 'admin'], adminScopes: ['product'] })
      .where(eq(users.id, admin.userId));
  });
  afterAll(async () => {
    await app.close();
  });

  async function cleanFile(owner: U, purpose: 'avatar' | 'portfolio') {
    const id = uuidv7();
    await filesRepository(app.get<DbClient>(DB).db).create(
      { userId: owner.userId },
      {
        id,
        storageKey: `u/${owner.userId}/${id}`,
        originalName: 'x.png',
        mimeType: 'image/png',
        sizeBytes: 5,
        purpose,
        status: 'clean',
      },
    );
    return id;
  }

  describe('mode switch & profile', () => {
    it('requires authentication', async () => {
      expect((await call(null, 'PATCH', '/me/mode', { mode: 'buyer' })).statusCode).toBe(401);
      expect((await call(null, 'GET', '/me/profile')).statusCode).toBe(401);
    });

    it('cannot switch to seller before becoming one, then can', async () => {
      expect((await call(alice, 'PATCH', '/me/mode', { mode: 'seller' })).statusCode).toBe(422);
      expect((await call(alice, 'POST', '/me/seller')).statusCode).toBe(201);
      const me = (await call(alice, 'GET', '/me')).json() as { roles: string[]; activeMode: string };
      expect(me.roles).toContain('seller');
      expect(me.activeMode).toBe('seller');
      expect((await call(alice, 'PATCH', '/me/mode', { mode: 'buyer' })).statusCode).toBe(200);
    });

    it('updates the profile and rejects a taken handle', async () => {
      const ok = await call(alice, 'PATCH', '/me/profile', {
        headline: 'Full-stack dev',
        slug: 'alice-builds',
      });
      expect(ok.statusCode).toBe(200);
      const clash = await call(bob, 'PATCH', '/me/profile', { slug: 'alice-builds' });
      expect(clash.statusCode).toBe(409);
      const bad = await call(bob, 'PATCH', '/me/profile', { slug: 'Not Valid!' });
      expect(bad.statusCode).toBe(400);
    });

    it("rejects someone else's file as an avatar with 404", async () => {
      const bobsFile = await cleanFile(bob, 'avatar');
      expect((await call(alice, 'PUT', '/me/profile/avatar', { fileId: bobsFile })).statusCode).toBe(404);
      const own = await cleanFile(alice, 'avatar');
      const res = await call(alice, 'PUT', '/me/profile/avatar', { fileId: own });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { avatarUrl: string }).avatarUrl).toContain(own);
    });
  });

  describe('seller onboarding & portfolio', () => {
    it('non-sellers cannot touch seller endpoints', async () => {
      expect((await call(bob, 'PATCH', '/me/seller', { availability: 'busy' })).statusCode).toBe(422);
      expect((await call(bob, 'PUT', '/me/seller/skills', { skills: ['React'] })).statusCode).toBe(422);
    });

    it('cannot complete onboarding early, public profile hides the unpublished seller', async () => {
      expect((await call(alice, 'POST', '/me/seller/onboarding/complete')).statusCode).toBe(422);
      const pub = (await call(null, 'GET', '/profiles/alice-builds')).json() as { seller: unknown };
      expect(pub.seller).toBeNull();
    });

    it('walks the wizard and publishes', async () => {
      await call(alice, 'PATCH', '/me/profile', { bio: 'I build things.', country: 'PK' });
      const skills = await call(alice, 'PUT', '/me/seller/skills', { skills: ['React', 'Node.js', 'react'] });
      expect((skills.json() as { seller: { skills: unknown[] } }).seller.skills).toHaveLength(2);
      await call(alice, 'PATCH', '/me/seller', { hourlyRateAmount: 4500, yearsExperience: 6 });
      const status = await call(alice, 'POST', '/me/seller/onboarding/complete');
      expect(status.statusCode).toBe(201);
      expect((status.json() as { complete: boolean }).complete).toBe(true);

      const pub = (await call(null, 'GET', '/profiles/alice-builds')).json() as {
        email?: string;
        seller: { skills: { slug: string }[]; payoutPreference: string | null };
      };
      expect(pub.seller.skills.map((s) => s.slug).sort()).toEqual(['node-js', 'react']);
      expect(pub.seller.payoutPreference).toBeNull();
      expect(pub.email).toBeUndefined();
    });

    it("portfolio items are private to their owner's edits", async () => {
      const added = await call(alice, 'POST', '/me/seller/portfolio', {
        title: 'Shop app',
        url: 'https://example.com/shop',
      });
      expect(added.statusCode).toBe(201);
      const itemId = (added.json() as { seller: { portfolio: { id: string }[] } }).seller.portfolio[0]!.id;

      await call(bob, 'POST', '/me/seller');
      expect((await call(bob, 'PUT', `/me/seller/portfolio/${itemId}`, { title: 'hijack' })).statusCode).toBe(
        404,
      );
      expect((await call(bob, 'DELETE', `/me/seller/portfolio/${itemId}`)).statusCode).toBe(404);
      expect(
        (await call(alice, 'POST', '/me/seller/portfolio', { title: 'x', url: 'javascript:alert(1)' }))
          .statusCode,
      ).toBe(400);
      expect((await call(alice, 'DELETE', `/me/seller/portfolio/${itemId}`)).statusCode).toBe(200);
    });
  });

  describe('organizations', () => {
    let orgId: string;

    it('owner creates a team; outsiders get 404', async () => {
      const created = await call(alice, 'POST', '/orgs', { name: 'Alice Studio', kind: 'agency' });
      expect(created.statusCode).toBe(201);
      orgId = (created.json() as { id: string }).id;
      expect((await call(bob, 'GET', `/orgs/${orgId}`)).statusCode).toBe(404);
      expect(
        (await call(bob, 'POST', `/orgs/${orgId}/invites`, { email: 'x@example.test' })).statusCode,
      ).toBe(404);
      expect(((await call(bob, 'GET', '/orgs')).json() as unknown[]).length).toBe(0);
    });

    it('invite is emailed, only the invited email can accept, token is single use', async () => {
      const inv = await call(alice, 'POST', `/orgs/${orgId}/invites`, { email: bob.email });
      expect(inv.statusCode).toBe(201);
      const job = await findEmailJob(bob.email, 'org-invite');
      const token = new URL(job!.data.url as string).searchParams.get('token')!;

      expect((await call(admin, 'POST', '/invites/accept', { token })).statusCode).toBe(404);
      const ok = await call(bob, 'POST', '/invites/accept', { token });
      expect(ok.statusCode).toBe(201);
      expect((ok.json() as { myRole: string }).myRole).toBe('member');
      expect((await call(bob, 'POST', '/invites/accept', { token })).statusCode).toBe(404);
    });

    it('members cannot manage; owner cannot be removed; member can leave', async () => {
      expect(
        (await call(bob, 'POST', `/orgs/${orgId}/invites`, { email: 'z@example.test' })).statusCode,
      ).toBe(403);
      expect((await call(bob, 'DELETE', `/orgs/${orgId}/members/${alice.userId}`)).statusCode).toBe(403);
      expect((await call(alice, 'DELETE', `/orgs/${orgId}/members/${alice.userId}`)).statusCode).toBe(422);
      expect(
        (await call(bob, 'PATCH', `/orgs/${orgId}/members/${bob.userId}`, { role: 'admin' })).statusCode,
      ).toBe(403);
      expect((await call(bob, 'DELETE', `/orgs/${orgId}/members/${bob.userId}`)).statusCode).toBe(200);
      expect((await call(bob, 'GET', `/orgs/${orgId}`)).statusCode).toBe(404);
    });
  });

  describe('sessions', () => {
    it("lists own sessions only and cannot revoke another user's", async () => {
      const mine = (await call(alice, 'GET', '/me/sessions')).json() as { id: string; current: boolean }[];
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.some((s) => s.current)).toBe(true);
      const res = await call(bob, 'DELETE', `/me/sessions/${mine[0]!.id}`);
      expect(res.statusCode).toBe(404);
    });

    it('revoke-all logs the device out', async () => {
      const second = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in/email',
        headers: ORIGIN,
        payload: { email: bob.email, password: 'correct-horse-battery' },
      });
      expect(second.statusCode).toBe(200);
      expect((await call(bob, 'POST', '/me/sessions/revoke-all')).statusCode).toBe(201);
      expect((await call(bob, 'GET', '/me')).statusCode).toBe(401);
    });
  });

  describe('two-factor authentication', () => {
    it('enables TOTP, then sign-in requires the code', async () => {
      const carol = await signUpVerified(app, { name: 'Carol Secure' });
      const enable = await call(carol, 'POST', '/auth/two-factor/enable', {
        password: 'correct-horse-battery',
      });
      expect(enable.statusCode).toBe(200);
      const { totpURI, backupCodes } = enable.json() as { totpURI: string; backupCodes: string[] };
      expect(backupCodes.length).toBeGreaterThan(0);
      const secret = new URL(totpURI).searchParams.get('secret')!;

      const wrong = await call(carol, 'POST', '/auth/two-factor/verify-totp', { code: '000000' });
      expect(wrong.statusCode).toBeGreaterThanOrEqual(400);
      const ok = await app.inject({
        method: 'POST',
        url: '/v1/auth/two-factor/verify-totp',
        headers: { ...ORIGIN, cookie: carol.cookie },
        payload: { code: totp(secret) },
      });
      expect(ok.statusCode).toBe(200);
      // Enabling 2FA rotates the session: the old cookie is dead, the new one works.
      expect((await call(carol, 'GET', '/me')).statusCode).toBe(401);
      const rotated = { ...carol, cookie: cookies(ok.headers['set-cookie']) };
      expect(
        ((await call(rotated, 'GET', '/me')).json() as { twoFactorEnabled: boolean }).twoFactorEnabled,
      ).toBe(true);

      // A fresh password sign-in no longer yields a session until the second factor is given.
      const signIn = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in/email',
        headers: ORIGIN,
        payload: { email: carol.email, password: 'correct-horse-battery' },
      });
      expect((signIn.json() as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
      const pending = (
        Array.isArray(signIn.headers['set-cookie'])
          ? signIn.headers['set-cookie']
          : [String(signIn.headers['set-cookie'])]
      )
        .map((c) => c.split(';')[0])
        .join('; ');
      expect((await call({ ...carol, cookie: pending }, 'GET', '/me')).statusCode).toBe(401);

      const second = await app.inject({
        method: 'POST',
        url: '/v1/auth/two-factor/verify-totp',
        headers: { ...ORIGIN, cookie: pending },
        payload: { code: totp(secret) },
      });
      expect(second.statusCode).toBe(200);
      const sessionCookie = [second.headers['set-cookie']]
        .flat()
        .map((c) => String(c).split(';')[0])
        .join('; ');
      expect((await call({ ...carol, cookie: sessionCookie }, 'GET', '/me')).statusCode).toBe(200);
    });
  });

  describe('admin skeleton', () => {
    it('non-admins get 403, anonymous 401', async () => {
      expect((await call(null, 'GET', '/admin/users')).statusCode).toBe(401);
      expect((await call(alice, 'GET', '/admin/users')).statusCode).toBe(403);
      expect((await call(alice, 'GET', '/admin/audit-logs')).statusCode).toBe(403);
      expect(
        (await call(alice, 'PATCH', `/admin/users/${alice.userId}/scopes`, { scopes: ['product'] }))
          .statusCode,
      ).toBe(403);
    });

    it('admins list users, read audit logs and assign scopes (audited)', async () => {
      const list = await call(admin, 'GET', '/admin/users?q=alice');
      expect(list.statusCode).toBe(200);
      expect((list.json() as { items: { email: string }[] }).items.map((u) => u.email)).toContain(
        alice.email,
      );

      const set = await call(admin, 'PATCH', `/admin/users/${alice.userId}/scopes`, { scopes: ['growth'] });
      expect(set.statusCode).toBe(200);
      const logs = (await call(admin, 'GET', '/admin/audit-logs?action=admin.scopes_changed')).json() as {
        items: { entityId: string }[];
      };
      expect(logs.items.some((l) => l.entityId === alice.userId)).toBe(true);
    });

    it('an admin without the product scope cannot assign scopes', async () => {
      // alice now holds the growth scope + admin role
      expect((await call(alice, 'GET', '/admin/users')).statusCode).toBe(200);
      expect(
        (await call(alice, 'PATCH', `/admin/users/${alice.userId}/scopes`, { scopes: ['product'] }))
          .statusCode,
      ).toBe(403);
    });
  });
});
