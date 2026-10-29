import type { GigHelperResult, OnboardingState, ServiceDetailView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootMarket, createTestApp } from './helpers';

describe('UX overhaul: first-run state, gig helper, tags and sub-categories', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;

  beforeAll(async () => {
    app = await createTestApp();
    m = await bootMarket(app);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('first-run state is per user, merges updates and rejects junk', async () => {
    const { call, json, buyer, seller } = m;
    expect((await call(null, 'GET', '/me/onboarding')).statusCode).toBe(401);
    expect(json<OnboardingState>(await call(buyer, 'GET', '/me/onboarding'))).toEqual({
      welcomed: false,
      tours: {},
      checklistHidden: false,
    });
    await call(buyer, 'PATCH', '/me/onboarding', { welcomed: true, tours: { buyer: true } });
    const after = json<OnboardingState>(
      await call(buyer, 'PATCH', '/me/onboarding', { tours: { room: true } }),
    );
    expect(after).toEqual({ welcomed: true, tours: { buyer: true, room: true }, checklistHidden: false });
    // another user is unaffected
    expect(json<OnboardingState>(await call(seller, 'GET', '/me/onboarding')).welcomed).toBe(false);
    expect((await call(buyer, 'PATCH', '/me/onboarding', { tours: { admin: true } })).statusCode).toBe(400);
  });

  it('gig helper needs a session and returns shaped suggestions (offline provider)', async () => {
    const { call, json, seller } = m;
    expect(
      (await call(null, 'POST', '/ai/gig-helper', { kind: 'faqs', categorySlug: 'design' })).statusCode,
    ).toBe(401);
    expect(
      (await call(seller, 'POST', '/ai/gig-helper', { kind: 'nope', categorySlug: 'design' })).statusCode,
    ).toBe(400);
    const r = json<GigHelperResult>(
      await call(seller, 'POST', '/ai/gig-helper', { kind: 'packages', categorySlug: 'design' }),
    );
    expect(r.packages).toHaveLength(3);
    const t = json<GigHelperResult>(
      await call(seller, 'POST', '/ai/gig-helper', {
        kind: 'title',
        categorySlug: 'design',
        title: 'logo design',
      }),
    );
    expect(t.title).toMatch(/^I will /);
  });

  it('sub-categories exist, services keep tags, and tags are searchable', async () => {
    const { call, json, seller } = m;
    const cats = json<{ id: string; slug: string; parentId: string | null }[]>(
      await call(null, 'GET', '/categories'),
    );
    const flutter = cats.find((c) => c.slug === 'cross-platform');
    expect(flutter?.parentId).toBe(cats.find((c) => c.slug === 'mobile-apps')!.id);
    const input = {
      categoryId: flutter!.id,
      title: 'I will build your Flutter app with tags',
      description: 'A complete Flutter app for your small business with clear steps and tests included.',
      tags: ['Flutter', 'flutter', 'xylophoneq'],
      packages: [
        {
          tier: 'basic',
          title: 'Starter',
          description: 'Three screens and login',
          priceAmount: 30000,
          deliveryDays: 10,
          revisions: 1,
        },
      ],
    };
    const created = json<ServiceDetailView>(await call(seller, 'POST', '/me/services', input));
    expect(created.tags).toEqual(['flutter', 'xylophoneq']);
    expect(
      (await call(seller, 'POST', '/me/services', { ...input, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }))
        .statusCode,
    ).toBe(400);
  });
});
