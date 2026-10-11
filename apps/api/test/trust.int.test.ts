import { accounts, sql, type DbClient } from '@glasswork/db';
import type {
  ProfileView,
  ProjectView,
  ReviewView,
  SellerStatsView,
  ServicePageView,
  VerificationView,
} from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import {
  bootMarket,
  createFile,
  createTestApp,
  makeAdmin,
  publishSeller,
  signUpVerified,
  type TestUser,
} from './helpers';

describe('Phase 5: reviews, levels, verifications, trust filters', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;
  let db: DbClient;
  let call: typeof m.call;
  let json: typeof m.json;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;
  let ops: TestUser;
  let growth: TestUser;
  let slug: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DbClient>(DB);
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other, ops } = m);
    growth = await signUpVerified(app, { name: 'Growth' });
    await makeAdmin(app, growth, ['growth']);
    slug = json<ProfileView>(await call(seller, 'GET', '/me/profile')).slug!;
  });
  afterAll(async () => {
    await app?.close();
  });

  const view = async (u: TestUser, id: string) => json<ProjectView>(await call(u, 'GET', `/projects/${id}`));
  /** Drives an ACTIVE project (m1 started) all the way to completed. */
  async function finish(projectId: string, ids: string[]) {
    for (const [i, id] of ids.entries()) {
      if (i > 0) {
        await m.fund(buyer, id);
        await call(seller, 'POST', `/milestones/${id}/start`);
      }
      await call(seller, 'POST', `/milestones/${id}/submit`, {});
      expect((await call(buyer, 'POST', `/milestones/${id}/approve`)).statusCode).toBe(201);
    }
    expect((await view(buyer, projectId)).status).toBe('completed');
  }
  const final = (r = 5) => ({
    ratingOverall: r,
    ratingCommunication: r,
    ratingQuality: r,
    ratingTimeliness: r,
    body: 'Great work, delivered on time.',
  });

  describe('reviews', () => {
    it('private milestone feedback opens only after payment, once, buyer only', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const m1 = milestoneIds[0]!;
      expect((await call(buyer, 'POST', `/milestones/${m1}/feedback`, { rating: 5 })).statusCode).toBe(422); // not paid yet
      await call(seller, 'POST', `/milestones/${m1}/submit`, {});
      await call(buyer, 'POST', `/milestones/${m1}/approve`);
      expect((await call(seller, 'POST', `/milestones/${m1}/feedback`, { rating: 5 })).statusCode).toBe(422);
      expect((await call(other, 'POST', `/milestones/${m1}/feedback`, { rating: 5 })).statusCode).toBe(404);
      expect((await call(buyer, 'POST', `/milestones/${m1}/feedback`, { rating: 9 })).statusCode).toBe(400);
      expect(
        (await call(buyer, 'POST', `/milestones/${m1}/feedback`, { rating: 4, body: 'Clear communication' }))
          .statusCode,
      ).toBe(201);
      expect((await call(buyer, 'POST', `/milestones/${m1}/feedback`, { rating: 5 })).statusCode).toBe(409);

      const asSeller = json<{ feedback: { rating: number; body: string }[] }>(
        await call(seller, 'GET', `/projects/${projectId}/reviews`),
      );
      expect(asSeller.feedback).toEqual([{ milestoneId: m1, rating: 4, body: 'Clear communication' }]);
      expect((await call(other, 'GET', `/projects/${projectId}/reviews`)).statusCode).toBe(404);
      // private feedback never reaches the public profile or the rating
      const pub = json<{ items: unknown[]; stats: SellerStatsView }>(
        await call(null, 'GET', `/profiles/${slug}/reviews`),
      );
      expect(pub.items.every((r) => (r as ReviewView).body !== 'Clear communication')).toBe(true);
    });

    it('the public review: paying buyer of a completed project only, once, with sub-ratings; then reply once', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      expect((await call(buyer, 'POST', `/projects/${projectId}/review`, final())).statusCode).toBe(422); // not completed
      await finish(projectId, milestoneIds);

      expect((await call(null, 'POST', `/projects/${projectId}/review`, final())).statusCode).toBe(401);
      expect((await call(other, 'POST', `/projects/${projectId}/review`, final())).statusCode).toBe(404);
      expect((await call(seller, 'POST', `/projects/${projectId}/review`, final())).statusCode).toBe(422); // can't review yourself
      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/review`, { ratingOverall: 5 })).statusCode,
      ).toBe(400); // sub-ratings required
      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/review`, { ...final(), ratingQuality: 0 }))
          .statusCode,
      ).toBe(400);
      expect(
        json<{ canReview: boolean }>(await call(buyer, 'GET', `/projects/${projectId}/reviews`)).canReview,
      ).toBe(true);

      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/review`, { ...final(5), ratingTimeliness: 4 }))
          .statusCode,
      ).toBe(201);
      expect((await view(buyer, projectId)).status).toBe('reviewed');
      expect((await call(buyer, 'POST', `/projects/${projectId}/review`, final())).statusCode).toBe(422);
      expect(
        json<{ canReview: boolean; review: { ratingOverall: number } }>(
          await call(buyer, 'GET', `/projects/${projectId}/reviews`),
        ),
      ).toMatchObject({ canReview: false, review: { ratingOverall: 5 } });

      const pub = json<{ items: ReviewView[]; stats: SellerStatsView }>(
        await call(null, 'GET', `/profiles/${slug}/reviews`),
      );
      const rev = pub.items.find((r) => r.ratingTimeliness === 4)!;
      expect(rev.author.name).toMatch(/^Buyer$/); // single-word name stays as is, never an email
      expect(rev.reply).toBeNull();
      expect(JSON.stringify(pub)).not.toContain('@example.test');

      expect((await call(buyer, 'POST', `/reviews/${rev.id}/reply`, { body: 'Thanks!' })).statusCode).toBe(
        404,
      );
      expect((await call(other, 'POST', `/reviews/${rev.id}/reply`, { body: 'Thanks!' })).statusCode).toBe(
        404,
      );
      expect((await call(seller, 'POST', `/reviews/${rev.id}/reply`, { body: 'x' })).statusCode).toBe(400);
      expect(
        (await call(seller, 'POST', `/reviews/${rev.id}/reply`, { body: 'Thank you, a pleasure!' }))
          .statusCode,
      ).toBe(201);
      expect(
        (await call(seller, 'POST', `/reviews/${rev.id}/reply`, { body: 'Thank you again!' })).statusCode,
      ).toBe(409);
      const after = json<{ items: ReviewView[] }>(await call(null, 'GET', `/profiles/${slug}/reviews`));
      expect(after.items.find((r) => r.id === rev.id)!.reply?.body).toBe('Thank you, a pleasure!');
    });

    it('refunded or cancelled work cannot be reviewed publicly', async () => {
      const o = await m.activeProject();
      // decline path isn't possible once active; simulate a project that completed with nothing paid
      await db.db.execute(sql`update projects set status = 'completed' where id = ${o.projectId}`);
      expect((await call(buyer, 'POST', `/projects/${o.projectId}/review`, final())).statusCode).toBe(422);
      await db.db.execute(sql`update projects set status = 'active' where id = ${o.projectId}`);
    });

    it('unknown or unpublished profiles have no review page', async () => {
      expect((await call(null, 'GET', '/profiles/nobody-here/reviews')).statusCode).toBe(404);
    });
  });

  describe('seller levels and trust filters', () => {
    it('publishes the criteria; a seller with too little history stays "New seller"', async () => {
      const levels = json<{ key: string; criteria: { completedProjects: number } }[]>(
        await call(null, 'GET', '/seller-levels'),
      );
      expect(levels.map((l) => l.key)).toEqual(['new', 'level_1', 'level_2', 'top_rated']);
      const stats = json<{ stats: SellerStatsView }>(
        await call(null, 'GET', `/profiles/${slug}/reviews`),
      ).stats;
      expect(stats.level).toBe('new');
      expect(stats.reviewCount).toBe(1);
    });

    it('reaches Level 1 from real data (3 completed, 3 public reviews ≥ 4.0, on time) and search filters follow', async () => {
      for (const rating of [4, 5]) {
        const { projectId, milestoneIds } = await m.activeProject();
        await finish(projectId, milestoneIds);
        expect((await call(buyer, 'POST', `/projects/${projectId}/review`, final(rating))).statusCode).toBe(
          201,
        );
      }
      const stats = json<{ stats: SellerStatsView }>(
        await call(null, 'GET', `/profiles/${slug}/reviews`),
      ).stats;
      expect(stats).toMatchObject({
        completedProjects: 3,
        reviewCount: 3,
        level: 'level_1',
        levelLabel: 'Level 1',
      });
      expect(stats.avgRating).toBeCloseTo(4.67, 1);
      expect(stats.onTimeRate).toBe(1);
      expect(stats.subRatings.quality).toBeCloseTo(4.67, 1);

      const mine = json<ServicePageView>(await call(null, 'GET', '/services?limit=50')).items.filter(
        (s) => s.seller.id === seller.userId,
      );
      expect(mine.length).toBeGreaterThan(0);
      expect(mine[0]!.trust).toMatchObject({ level: 'level_1', reviewCount: 3, verified: false });

      const ids = async (qs: string) =>
        json<ServicePageView>(await call(null, 'GET', `/services?limit=50&${qs}`)).items.map((s) => s.id);
      const sellerService = mine[0]!.id;
      expect(await ids('minRating=4.5')).toContain(sellerService);
      expect(await ids('minRating=4.9')).not.toContain(sellerService);
      expect(await ids('level=level_1')).toContain(sellerService);
      expect(await ids('level=level_2')).not.toContain(sellerService);
      expect(await ids('level=new')).toContain(sellerService);
      expect((await call(null, 'GET', '/services?level=godlike')).statusCode).toBe(400);
      expect((await call(null, 'GET', '/services?minRating=9')).statusCode).toBe(400);
    });

    it('a seller without reviews never matches a rating filter, and sorting by rating puts rated sellers first', async () => {
      const fresh = await signUpVerified(app, { name: 'Fresh Seller' });
      await publishSeller(call, fresh);
      const cats = json<{ id: string }[]>(await call(null, 'GET', '/categories'));
      const svc = json<{ id: string }>(
        await call(fresh, 'POST', '/me/services', {
          categoryId: cats[0]!.id,
          title: 'Unrated seller fresh service listing',
          description:
            'A complete production-ready build with tests, CI and clear milestones for every stage of delivery.',
          packages: [
            {
              tier: 'basic',
              title: 'Basic',
              description: 'Everything included in it',
              priceAmount: 50_000,
              deliveryDays: 7,
              revisions: 1,
            },
          ],
        }),
      );
      await call(fresh, 'POST', `/me/services/${svc.id}/submit`);
      await call(ops, 'POST', `/admin/services/${svc.id}/approve`);

      const rated = json<ServicePageView>(
        await call(null, 'GET', '/services?limit=50&minRating=1'),
      ).items.map((s) => s.id);
      expect(rated).not.toContain(svc.id);
      const sorted = json<ServicePageView>(await call(null, 'GET', '/services?limit=50&sort=rating')).items;
      const idxRated = sorted.findIndex((s) => s.seller.id === seller.userId);
      const idxFresh = sorted.findIndex((s) => s.id === svc.id);
      expect(idxRated).toBeGreaterThanOrEqual(0);
      expect(idxFresh).toBeGreaterThan(idxRated);
    });
  });

  describe('verifications and badges', () => {
    const request = (u: TestUser, body: unknown) => call(u, 'POST', '/me/verifications', body);
    const statusOf = async (u: TestUser, kind: string) =>
      json<VerificationView[]>(await call(u, 'GET', '/me/verifications')).find((v) => v.kind === kind)!;

    it('sellers only; inputs are checked; duplicates are refused', async () => {
      expect((await call(null, 'GET', '/me/verifications')).statusCode).toBe(401);
      expect((await call(other, 'GET', '/me/verifications')).statusCode).toBe(403);
      expect(
        (await request(seller, { kind: 'play_store', url: 'https://evil.example.com/x' })).statusCode,
      ).toBe(422);
      expect((await request(seller, { kind: 'play_store' })).statusCode).toBe(422);
      expect((await request(seller, { kind: 'app_store', url: 'http://apps.apple.com/x' })).statusCode).toBe(
        400,
      );
      expect((await request(seller, { kind: 'portfolio' })).statusCode).toBe(422);
      expect((await request(seller, { kind: 'identity' })).statusCode).toBe(422);
      const mine = await createFile(app, seller, 'evidence', { name: 'id.pdf' });
      const theirs = await createFile(app, buyer, 'evidence');
      const pending = await createFile(app, seller, 'evidence', { status: 'uploaded' });
      expect((await request(seller, { kind: 'identity', evidenceFileId: theirs })).statusCode).toBe(404);
      expect((await request(seller, { kind: 'identity', evidenceFileId: pending })).statusCode).toBe(422);

      expect(
        (await request(seller, { kind: 'portfolio', url: 'https://portfolio.example.com' })).statusCode,
      ).toBe(201);
      expect(
        (await request(seller, { kind: 'portfolio', url: 'https://portfolio.example.com' })).statusCode,
      ).toBe(422); // already pending
      expect((await request(seller, { kind: 'identity', evidenceFileId: mine })).statusCode).toBe(201);
      expect((await statusOf(seller, 'portfolio')).status).toBe('pending');
    });

    it('badges appear only after an admin verifies; rejection needs a reason and can be retried', async () => {
      const queue = json<{ id: string; kind: string; sellerName: string }[]>(
        await call(ops, 'GET', '/admin/verifications'),
      );
      const portfolio = queue.find((q) => q.kind === 'portfolio')!;
      const identity = queue.find((q) => q.kind === 'identity')!;
      expect((await call(seller, 'GET', '/admin/verifications')).statusCode).toBe(403);
      expect(
        (
          await call(growth, 'POST', `/admin/verifications/${portfolio.id}/decision`, {
            decision: 'verified',
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await call(ops, 'POST', `/admin/verifications/${identity.id}/decision`, { decision: 'rejected' }))
          .statusCode,
      ).toBe(422);

      // pending is not a badge
      let pub = json<ProfileView>(await call(null, 'GET', `/profiles/${slug}`));
      expect(pub.seller!.trust.badges).toEqual([]);

      expect((await call(ops, 'GET', `/admin/verifications/${identity.id}/evidence`)).statusCode).toBe(200);
      expect((await call(growth, 'GET', `/admin/verifications/${identity.id}/evidence`)).statusCode).toBe(
        403,
      );
      expect(
        (
          await call(ops, 'POST', `/admin/verifications/${portfolio.id}/decision`, {
            decision: 'verified',
            note: 'Checked',
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (await call(ops, 'POST', `/admin/verifications/${portfolio.id}/decision`, { decision: 'verified' }))
          .statusCode,
      ).toBe(422);
      expect(
        (
          await call(ops, 'POST', `/admin/verifications/${identity.id}/decision`, {
            decision: 'rejected',
            note: 'Document unreadable',
          })
        ).statusCode,
      ).toBe(201);

      pub = json<ProfileView>(await call(null, 'GET', `/profiles/${slug}`));
      expect(pub.seller!.trust.badges).toEqual(['portfolio']); // verified only, not the rejected one
      expect((await statusOf(seller, 'identity')).reviewNote).toBe('Document unreadable');
      const mine = await createFile(app, seller, 'evidence', { name: 'id2.pdf' });
      expect((await request(seller, { kind: 'identity', evidenceFileId: mine })).statusCode).toBe(201); // retry after rejection
      const n = json<{ items: { type: string }[] }>(await call(seller, 'GET', '/me/notifications'));
      expect(n.items.filter((i) => i.type === 'verification.decided').length).toBeGreaterThanOrEqual(2);
    });

    it('a linked GitHub account counts automatically, and verified-only search follows', async () => {
      const ids = async (qs: string) =>
        json<ServicePageView>(await call(null, 'GET', `/services?limit=50&${qs}`)).items;
      // portfolio badge from the previous test already makes this seller "verified"
      expect(
        (await ids('verifiedOnly=true')).some((s) => s.seller.id === seller.userId && s.trust.verified),
      ).toBe(true);
      expect((await ids('verifiedOnly=true')).every((s) => s.trust.verified)).toBe(true);

      const gh = await signUpVerified(app, { name: 'Git Hub User' });
      await publishSeller(call, gh);
      expect(
        json<VerificationView[]>(await call(gh, 'GET', '/me/verifications')).find((v) => v.kind === 'github'),
      ).toMatchObject({ status: 'none', automatic: false });
      await db.db
        .insert(accounts)
        .values({ id: uuidv7(), userId: gh.userId, providerId: 'github', accountId: 'gh-12345' });
      expect(
        json<VerificationView[]>(await call(gh, 'GET', '/me/verifications')).find((v) => v.kind === 'github'),
      ).toMatchObject({ status: 'verified', automatic: true });
      const pub = json<ProfileView>(
        await call(null, 'GET', `/profiles/${json<ProfileView>(await call(gh, 'GET', '/me/profile')).slug}`),
      );
      expect(pub.seller!.trust.badges).toEqual(['github']);
      expect((await request(gh, { kind: 'github', handle: 'x' })).statusCode).toBe(422);
    });
  });
});
