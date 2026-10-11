import { eq, filesRepository, users, type DbClient } from '@glasswork/db';
import type { ServiceDetailView, ServicePageView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { createTestApp, ORIGIN, signUpVerified } from './helpers';

type U = Awaited<ReturnType<typeof signUpVerified>>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

describe('Phase 2: services, moderation, search, favorites', () => {
  let app: NestFastifyApplication;
  let sellerA: U;
  let sellerB: U;
  let buyer: U;
  let ops: U;
  let plainAdmin: U;
  let webCat: string;
  let mobileCat: string;

  const call = (u: U | null, method: Method, url: string, payload?: unknown) =>
    app.inject({
      method,
      url: `/v1${url}`,
      headers: { ...ORIGIN, ...(u && { cookie: u.cookie }) },
      ...(payload !== undefined && { payload: payload as object }),
    });
  const json = <T>(r: { json: () => unknown }) => r.json() as T;

  const input = (over: Record<string, unknown> = {}) => ({
    categoryId: webCat,
    title: 'I will build your React web application',
    description:
      'Production-ready React and Node.js applications with tests, CI and clear milestones for every stage of the build.',
    packages: [
      {
        tier: 'basic',
        title: 'Landing page',
        description: 'A single responsive page',
        priceAmount: 50_000,
        deliveryDays: 7,
        revisions: 1,
      },
      {
        tier: 'premium',
        title: 'Full app',
        description: 'Auth, dashboard and API',
        priceAmount: 250_000,
        deliveryDays: 30,
        revisions: 3,
      },
    ],
    extras: [{ title: 'Source code handover', priceAmount: 5_000, extraDays: 1 }],
    faqs: [{ question: 'Do you sign NDAs?', answer: 'Yes, on request.' }],
    ...over,
  });

  async function publishSeller(u: U) {
    await call(u, 'POST', '/me/seller');
    await call(u, 'PATCH', '/me/profile', { headline: 'Engineer', bio: 'Builds things', country: 'PK' });
    await call(u, 'PUT', '/me/seller/skills', { skills: ['React'] });
    await call(u, 'PATCH', '/me/seller', { hourlyRateAmount: 4000 });
    const r = await call(u, 'POST', '/me/seller/onboarding/complete');
    expect(r.statusCode).toBe(201);
  }

  /** create → submit → approve; returns the live service. */
  async function liveService(owner: U, over: Record<string, unknown> = {}) {
    const created = json<ServiceDetailView>(await call(owner, 'POST', '/me/services', input(over)));
    expect((await call(owner, 'POST', `/me/services/${created.id}/submit`)).statusCode).toBe(201);
    expect((await call(ops, 'POST', `/admin/services/${created.id}/approve`)).statusCode).toBe(201);
    return created;
  }

  beforeAll(async () => {
    app = await createTestApp();
    [sellerA, sellerB, buyer, ops, plainAdmin] = await Promise.all([
      signUpVerified(app, { name: 'Seller A' }),
      signUpVerified(app, { name: 'Seller B' }),
      signUpVerified(app, { name: 'Buyer' }),
      signUpVerified(app, { name: 'Ops Admin' }),
      signUpVerified(app, { name: 'Plain Admin' }),
    ]);
    const { db } = app.get<DbClient>(DB);
    await db
      .update(users)
      .set({ roles: ['buyer', 'admin'], adminScopes: ['operations'] })
      .where(eq(users.id, ops.userId));
    await db
      .update(users)
      .set({ roles: ['buyer', 'admin'], adminScopes: ['growth'] })
      .where(eq(users.id, plainAdmin.userId));
    const cats = json<{ id: string; slug: string }[]>(await call(null, 'GET', '/categories'));
    webCat = cats.find((c) => c.slug === 'web-development')!.id;
    mobileCat = cats.find((c) => c.slug === 'mobile-apps')!.id;
    await publishSeller(sellerA);
    await publishSeller(sellerB);
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves the category taxonomy publicly', async () => {
    const cats = json<{ slug: string }[]>(await call(null, 'GET', '/categories'));
    expect(cats.map((c) => c.slug)).toEqual(
      expect.arrayContaining(['web-development', 'mobile-apps', 'ai-ml']),
    );
  });

  describe('seller CRUD & ownership', () => {
    it('requires auth and the seller role', async () => {
      expect((await call(null, 'POST', '/me/services', input())).statusCode).toBe(401);
      expect((await call(buyer, 'POST', '/me/services', input())).statusCode).toBe(422);
    });

    it('validates input (duplicate tiers, bad price, unknown category, foreign image)', async () => {
      const dup = input({ packages: [input().packages[0], input().packages[0]] });
      expect((await call(sellerA, 'POST', '/me/services', dup)).statusCode).toBe(400);
      const cheap = input({ packages: [{ ...input().packages[0], priceAmount: 5 }] });
      expect((await call(sellerA, 'POST', '/me/services', cheap)).statusCode).toBe(400);
      expect((await call(sellerA, 'POST', '/me/services', input({ categoryId: uuidv7() }))).statusCode).toBe(
        422,
      );

      const fid = uuidv7();
      await filesRepository(app.get<DbClient>(DB).db).create(
        { userId: sellerB.userId },
        {
          id: fid,
          storageKey: `u/${sellerB.userId}/${fid}`,
          originalName: 'x.png',
          mimeType: 'image/png',
          sizeBytes: 5,
          purpose: 'portfolio',
          status: 'clean',
        },
      );
      expect((await call(sellerA, 'POST', '/me/services', input({ imageFileIds: [fid] }))).statusCode).toBe(
        404,
      );
      const own = await call(sellerB, 'POST', '/me/services', input({ imageFileIds: [fid] }));
      expect(own.statusCode).toBe(201);
      expect(json<ServiceDetailView>(own).images[0]!.url).toContain(fid);
    });

    it('drafts are private; other sellers get 404 on every verb', async () => {
      const created = json<ServiceDetailView>(await call(sellerA, 'POST', '/me/services', input()));
      expect(created.status).toBe('draft');
      expect((await call(null, 'GET', `/services/${created.slug}`)).statusCode).toBe(404);
      const list = json<ServicePageView>(await call(null, 'GET', '/services'));
      expect(list.items.some((s) => s.id === created.id)).toBe(false);

      expect((await call(sellerB, 'GET', `/me/services/${created.id}`)).statusCode).toBe(404);
      expect((await call(sellerB, 'PUT', `/me/services/${created.id}`, input())).statusCode).toBe(404);
      expect((await call(sellerB, 'POST', `/me/services/${created.id}/submit`)).statusCode).toBe(404);
      expect((await call(sellerB, 'DELETE', `/me/services/${created.id}`)).statusCode).toBe(404);
      expect(
        json<{ id: string }[]>(await call(sellerB, 'GET', '/me/services')).some((s) => s.id === created.id),
      ).toBe(false);
      expect((await call(sellerA, 'DELETE', `/me/services/${created.id}`)).statusCode).toBe(200);
    });

    it('cannot submit before the seller profile is published', async () => {
      const fresh = await signUpVerified(app, { name: 'Fresh Seller' });
      await call(fresh, 'POST', '/me/seller');
      const s = json<ServiceDetailView>(await call(fresh, 'POST', '/me/services', input()));
      expect((await call(fresh, 'POST', `/me/services/${s.id}/submit`)).statusCode).toBe(422);
    });
  });

  describe('moderation', () => {
    it('only admins with an operations/product scope approve; sellers cannot self-approve', async () => {
      const s = json<ServiceDetailView>(await call(sellerA, 'POST', '/me/services', input()));
      await call(sellerA, 'POST', `/me/services/${s.id}/submit`);
      expect((await call(sellerA, 'POST', `/admin/services/${s.id}/approve`)).statusCode).toBe(403);
      expect((await call(plainAdmin, 'POST', `/admin/services/${s.id}/approve`)).statusCode).toBe(403);
      expect((await call(null, 'GET', '/admin/services')).statusCode).toBe(401);

      const queue = json<ServicePageView>(await call(ops, 'GET', '/admin/services?status=pending_review'));
      expect(queue.items.some((x) => x.id === s.id)).toBe(true);

      const rej = await call(ops, 'POST', `/admin/services/${s.id}/reject`, { reason: 'Please add detail' });
      expect(json<ServiceDetailView>(rej).status).toBe('rejected');
      expect(json<ServiceDetailView>(rej).rejectionReason).toBe('Please add detail');
      expect((await call(ops, 'POST', `/admin/services/${s.id}/approve`)).statusCode).toBe(422);

      await call(sellerA, 'POST', `/me/services/${s.id}/submit`);
      const ok = await call(ops, 'POST', `/admin/services/${s.id}/approve`);
      expect(json<ServiceDetailView>(ok).status).toBe('live');
      const pub = json<ServiceDetailView>(await call(null, 'GET', `/services/${s.slug}`));
      expect(pub.packages.map((p) => p.tier)).toEqual(['basic', 'premium']);
      expect(pub.seller.displayName).toBe('Seller A');
    });

    it('editing a live service sends it back to review and hides it; pause/resume work', async () => {
      const s = await liveService(sellerA, { title: 'Editable live service for review tests' });
      const edited = await call(
        sellerA,
        'PUT',
        `/me/services/${s.id}`,
        input({ title: 'Editable live service, new title' }),
      );
      expect(json<ServiceDetailView>(edited).status).toBe('pending_review');
      expect((await call(null, 'GET', `/services/${s.slug}`)).statusCode).toBe(404);
      await call(ops, 'POST', `/admin/services/${s.id}/approve`);
      expect((await call(null, 'GET', `/services/${s.slug}`)).statusCode).toBe(200);

      expect(json<ServiceDetailView>(await call(sellerA, 'POST', `/me/services/${s.id}/pause`)).status).toBe(
        'paused',
      );
      expect((await call(null, 'GET', `/services/${s.slug}`)).statusCode).toBe(404);
      expect(json<ServiceDetailView>(await call(sellerA, 'POST', `/me/services/${s.id}/resume`)).status).toBe(
        'live',
      );
      expect((await call(sellerA, 'DELETE', `/me/services/${s.id}`)).statusCode).toBe(422);
    });

    it('platform label: only product admins set it, and the change is audited', async () => {
      const s = await liveService(sellerB, { title: 'A labelled platform-operated service' });
      expect(
        (
          await call(ops, 'PATCH', `/admin/services/${s.id}/operated-by-platform`, {
            operatedByPlatform: true,
          })
        ).statusCode,
      ).toBe(403);
      const product = await signUpVerified(app, { name: 'Product Admin' });
      await app
        .get<DbClient>(DB)
        .db.update(users)
        .set({ roles: ['buyer', 'admin'], adminScopes: ['product'] })
        .where(eq(users.id, product.userId));
      const res = await call(product, 'PATCH', `/admin/services/${s.id}/operated-by-platform`, {
        operatedByPlatform: true,
      });
      expect(json<ServiceDetailView>(res).operatedByPlatform).toBe(true);
      const logs = json<{ items: { entityId: string }[] }>(
        await call(product, 'GET', '/admin/audit-logs?action=service.platform_flag_changed'),
      );
      expect(logs.items.some((l) => l.entityId === s.id)).toBe(true);
    });
  });

  describe('search & discovery', () => {
    let react: ServiceDetailView;
    let flutter: ServiceDetailView;

    beforeAll(async () => {
      react = await liveService(sellerA, {
        title: 'Unique zebra React dashboards built fast',
        categoryId: webCat,
      });
      flutter = await liveService(sellerB, {
        title: 'Cross platform Flutter mobile apps',
        description:
          'Flutter apps for iOS and Android with a Node backend, release pipelines and store submission support.',
        categoryId: mobileCat,
        packages: [
          {
            tier: 'basic',
            title: 'MVP app',
            description: 'One platform MVP',
            priceAmount: 120_000,
            deliveryDays: 14,
            revisions: 2,
          },
        ],
      });
    });

    const search = async (qs: string) => json<ServicePageView>(await call(null, 'GET', `/services?${qs}`));

    it('full-text finds by title/description and tolerates typos via trigram similarity', async () => {
      expect((await search('q=zebra')).items.map((i) => i.id)).toEqual([react.id]);
      expect((await search('q=flutter')).items.map((i) => i.id)).toContain(flutter.id);
      expect((await search('q=React+dashbords')).items.map((i) => i.id)).toContain(react.id);
      expect((await search('q=nonexistentxyzterm')).items).toHaveLength(0);
    });

    it('filters by category, budget and delivery time', async () => {
      const mobile = (await search('category=mobile-apps')).items.map((i) => i.id);
      expect(mobile).toContain(flutter.id);
      expect(mobile).not.toContain(react.id);

      const cheap = (await search('maxPrice=60000')).items.map((i) => i.id);
      expect(cheap).toContain(react.id); // starts at $500
      expect(cheap).not.toContain(flutter.id); // starts at $1,200
      const pricey = (await search('minPrice=100000&maxPrice=130000')).items.map((i) => i.id);
      expect(pricey).toContain(flutter.id);

      const fast = (await search('maxDelivery=7')).items.map((i) => i.id);
      expect(fast).toContain(react.id);
      expect(fast).not.toContain(flutter.id);
    });

    it('sorts by price and paginates with opaque cursors', async () => {
      const asc = (await search('sort=price_asc&limit=50')).items.map((i) => i.fromPrice);
      expect(asc).toEqual([...asc].sort((a, b) => a - b));
      const desc = (await search('sort=price_desc&limit=50')).items.map((i) => i.fromPrice);
      expect(desc).toEqual([...desc].sort((a, b) => b - a));

      const all = (await search('limit=50')).items.map((i) => i.id);
      const p1 = await search('limit=2');
      expect(p1.items).toHaveLength(2);
      expect(p1.nextCursor).not.toBeNull();
      const p2 = await search(`limit=2&cursor=${p1.nextCursor}`);
      expect([...p1.items, ...p2.items].map((i) => i.id)).toEqual(all.slice(0, 2 + p2.items.length));
      expect((await search('cursor=garbage')).items.length).toBeGreaterThan(0);
    });

    it('hides services of banned sellers', async () => {
      const ban = await signUpVerified(app, { name: 'Soon Banned' });
      await publishSeller(ban);
      const s = await liveService(ban, { title: 'Banned sellers quokka service listing' });
      expect((await search('q=quokka')).items).toHaveLength(1);
      await app
        .get<DbClient>(DB)
        .db.update(users)
        .set({ bannedAt: new Date() })
        .where(eq(users.id, ban.userId));
      expect((await search('q=quokka')).items).toHaveLength(0);
      expect((await call(null, 'GET', `/services/${s.slug}`)).statusCode).toBe(404);
    });

    it('ranking is neutral to the “Operated by” label (D-002)', async () => {
      const a = await liveService(sellerA, { title: 'Neutrality aardvark pipeline service' });
      const b = await liveService(sellerB, { title: 'Neutrality aardvark pipeline service' });
      const before = (await search('q=aardvark')).items.map((i) => i.id);
      expect(before).toHaveLength(2);

      const product = await signUpVerified(app, { name: 'Product Admin 2' });
      await app
        .get<DbClient>(DB)
        .db.update(users)
        .set({ roles: ['buyer', 'admin'], adminScopes: ['product'] })
        .where(eq(users.id, product.userId));
      for (const target of [a, b]) {
        await call(product, 'PATCH', `/admin/services/${target.id}/operated-by-platform`, {
          operatedByPlatform: true,
        });
        expect((await search('q=aardvark')).items.map((i) => i.id)).toEqual(before);
        await call(product, 'PATCH', `/admin/services/${target.id}/operated-by-platform`, {
          operatedByPlatform: false,
        });
        expect((await search('q=aardvark')).items.map((i) => i.id)).toEqual(before);
      }
      const labelled = (await search('q=aardvark')).items;
      expect(labelled.every((i) => i.operatedByPlatform === false)).toBe(true);
    });

    it('favorites are per-user, live-only and idempotent', async () => {
      expect((await call(null, 'POST', `/services/${react.id}/favorite`)).statusCode).toBe(401);
      expect((await call(buyer, 'POST', `/services/${react.id}/favorite`)).statusCode).toBe(201);
      expect((await call(buyer, 'POST', `/services/${react.id}/favorite`)).statusCode).toBe(201);
      expect(json<string[]>(await call(buyer, 'GET', '/me/favorites/ids'))).toEqual([react.id]);
      expect(json<ServiceDetailView[]>(await call(buyer, 'GET', '/me/favorites')).map((s) => s.id)).toEqual([
        react.id,
      ]);
      expect(json<string[]>(await call(sellerB, 'GET', '/me/favorites/ids'))).toEqual([]);

      const draft = json<ServiceDetailView>(await call(sellerA, 'POST', '/me/services', input()));
      expect((await call(buyer, 'POST', `/services/${draft.id}/favorite`)).statusCode).toBe(404);

      expect((await call(buyer, 'DELETE', `/services/${react.id}/favorite`)).statusCode).toBe(200);
      expect(json<string[]>(await call(buyer, 'GET', '/me/favorites/ids'))).toEqual([]);
    });

    it('saved searches are private to their owner', async () => {
      const saved = await call(buyer, 'POST', '/me/saved-searches', {
        name: 'Cheap web',
        query: { category: 'web-development', maxPrice: 60000 },
      });
      expect(saved.statusCode).toBe(201);
      const id = json<{ id: string; query: { maxPrice: number } }[]>(saved)[0]!.id;
      expect(json<unknown[]>(await call(sellerA, 'GET', '/me/saved-searches'))).toHaveLength(0);
      expect((await call(sellerA, 'DELETE', `/me/saved-searches/${id}`)).statusCode).toBe(404);
      expect(json<unknown[]>(await call(buyer, 'DELETE', `/me/saved-searches/${id}`))).toHaveLength(0);
    });
  });
});
