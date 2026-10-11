import { users, eq, type DbClient } from '@glasswork/db';
import type { ChatMessageView, ServiceDetailView, ServicePageView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import {
  bootMarket,
  createTestApp,
  makeAdmin,
  ORIGIN,
  publishSeller,
  signUpVerified,
  type TestUser,
} from './helpers';

describe('Phase 5: chat safety, reports, bans and takedowns', () => {
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
  let serviceId: string;
  let directId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DbClient>(DB);
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other, ops } = m);
    growth = await signUpVerified(app, { name: 'Growth' });
    await makeAdmin(app, growth, ['growth']);
    const mine = json<ServicePageView>(await call(null, 'GET', '/services?limit=50')).items.find(
      (s) => s.seller.id === seller.userId,
    )!;
    serviceId = mine.id;
    directId = json<{ conversationId: string }>(
      await call(buyer, 'POST', '/conversations/direct', { userId: seller.userId }),
    ).conversationId;
  });
  afterAll(async () => {
    await app?.close();
  });
  const send = (u: TestUser, id: string, body: string) =>
    call(u, 'POST', `/conversations/${id}/messages`, { body });

  describe('chat safety warnings', () => {
    it('flags off-platform contact/payment details in pre-order chats, logs them, and never blocks the message', async () => {
      const clean = json<ChatMessageView>(
        await send(buyer, directId, 'Hi! Can you build a booking page for $900?'),
      );
      expect(clean.safetyFlags).toEqual([]);

      const r = await send(
        seller,
        directId,
        'Sure! Email me at sam@gmail.com or WhatsApp +44 7700 900123 and pay by bank transfer.',
      );
      expect(r.statusCode).toBe(201); // never blocked
      const msg = json<ChatMessageView>(r);
      expect(msg.safetyFlags.sort()).toEqual(['email', 'external_chat', 'offsite_payment', 'phone']);
      expect(msg.body).toContain('sam@gmail.com'); // stored as sent: log, don't silently alter

      // visible to the other party when they read the history, and logged for admins
      const hist = json<{ items: ChatMessageView[] }>(
        await call(buyer, 'GET', `/conversations/${directId}/messages`),
      );
      expect(hist.items.find((x) => x.id === msg.id)!.safetyFlags).toContain('offsite_payment');
      const logs = json<{ items: { entityId: string }[] }>(
        await call(ops, 'GET', '/admin/audit-logs?action=chat.safety_flag'),
      );
      expect(logs.items.some((l) => l.entityId === msg.id)).toBe(true);
    });

    it('does not flag the project chat (an order already exists)', async () => {
      const { projectId } = await m.activeProject();
      const cid = json<{ conversationId: string }>(
        await call(buyer, 'GET', `/projects/${projectId}/chat`),
      ).conversationId;
      expect(
        json<ChatMessageView>(await send(buyer, cid, 'My email is bea@example.test')).safetyFlags,
      ).toEqual([]);
    });
  });

  describe('reports', () => {
    const report = (u: TestUser | null, body: unknown) => call(u, 'POST', '/reports', body);

    it('validates the target, forbids self-reports, de-duplicates and only exposes what the reporter can see', async () => {
      const msg = json<ChatMessageView>(await send(seller, directId, 'a message the buyer can see'));
      expect(
        (await report(null, { targetType: 'user', targetId: seller.userId, reason: 'spam' })).statusCode,
      ).toBe(401);
      expect(
        (await report(buyer, { targetType: 'user', targetId: buyer.userId, reason: 'spam' })).statusCode,
      ).toBe(422);
      expect(
        (await report(buyer, { targetType: 'service', targetId: serviceId, reason: 'ab' })).statusCode,
      ).toBe(400);
      expect(
        (await report(seller, { targetType: 'service', targetId: serviceId, reason: 'my own' })).statusCode,
      ).toBe(422);
      expect(
        (
          await report(buyer, {
            targetType: 'user',
            targetId: '00000000-0000-7000-8000-000000000000',
            reason: 'spam',
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await report(other, { targetType: 'message', targetId: msg.id, reason: 'not my chat' })).statusCode,
      ).toBe(404);
      expect(
        (await report(seller, { targetType: 'message', targetId: msg.id, reason: 'my own message' }))
          .statusCode,
      ).toBe(422);

      expect(
        (
          await report(buyer, {
            targetType: 'service',
            targetId: serviceId,
            reason: 'Misleading description',
            details: 'Claims things it does not do',
          })
        ).statusCode,
      ).toBe(201);
      expect(
        (await report(buyer, { targetType: 'service', targetId: serviceId, reason: 'Again' })).statusCode,
      ).toBe(409);
      expect(
        (await report(buyer, { targetType: 'message', targetId: msg.id, reason: 'Harassment' })).statusCode,
      ).toBe(201);
    });

    it('is rate limited per user', async () => {
      const spammer = await signUpVerified(app, { name: 'Reporter' });
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) {
        const target = await signUpVerified(app, { name: `Target ${i}` });
        codes.push(
          (await report(spammer, { targetType: 'user', targetId: target.userId, reason: `reason ${i}` }))
            .statusCode,
        );
      }
      expect(codes.filter((c) => c === 201)).toHaveLength(10);
      expect(codes.slice(10)).toEqual([429, 429]);
    });

    it('the admin queue shows context; only operations/product decide, with a note; decisions are final', async () => {
      expect((await call(buyer, 'GET', '/admin/reports')).statusCode).toBe(403);
      const queue = json<
        {
          id: string;
          targetType: string;
          reporter: string;
          target: { label: string; excerpt: string | null };
        }[]
      >(await call(growth, 'GET', '/admin/reports'));
      const msgReport = queue.find((q) => q.targetType === 'message')!;
      expect(msgReport.target.excerpt).toBe('a message the buyer can see');
      expect(msgReport.reporter).toBe('Buyer');
      const body = { decision: 'actioned', note: 'Warned the user.' };
      expect((await call(growth, 'POST', `/admin/reports/${msgReport.id}/decision`, body)).statusCode).toBe(
        403,
      );
      expect(
        (
          await call(ops, 'POST', `/admin/reports/${msgReport.id}/decision`, {
            decision: 'actioned',
            note: 'x',
          })
        ).statusCode,
      ).toBe(400);
      expect((await call(ops, 'POST', `/admin/reports/${msgReport.id}/decision`, body)).statusCode).toBe(201);
      expect((await call(ops, 'POST', `/admin/reports/${msgReport.id}/decision`, body)).statusCode).toBe(422);
      expect(
        json<{ id: string }[]>(await call(ops, 'GET', '/admin/reports?status=actioned')).some(
          (q) => q.id === msgReport.id,
        ),
      ).toBe(true);
    });
  });

  describe('takedown and bans', () => {
    it('takedown pulls a live listing with a reason the seller sees; the seller can fix and resubmit', async () => {
      const body = { reason: 'Misleading claims in the description.' };
      expect((await call(seller, 'POST', `/admin/services/${serviceId}/takedown`, body)).statusCode).toBe(
        403,
      );
      expect((await call(growth, 'POST', `/admin/services/${serviceId}/takedown`, body)).statusCode).toBe(
        403,
      );
      expect(
        (await call(ops, 'POST', `/admin/services/${serviceId}/takedown`, { reason: 'no' })).statusCode,
      ).toBe(400);
      expect((await call(ops, 'POST', `/admin/services/${serviceId}/takedown`, body)).statusCode).toBe(201);
      expect((await call(ops, 'POST', `/admin/services/${serviceId}/takedown`, body)).statusCode).toBe(422);
      const mine = json<ServiceDetailView>(await call(seller, 'GET', `/me/services/${serviceId}`));
      expect(mine).toMatchObject({ status: 'rejected', rejectionReason: body.reason });
      expect(
        json<ServicePageView>(await call(null, 'GET', '/services?limit=50')).items.some(
          (s) => s.id === serviceId,
        ),
      ).toBe(false);
      expect((await call(seller, 'POST', `/me/services/${serviceId}/submit`)).statusCode).toBe(201);
      expect((await call(ops, 'POST', `/admin/services/${serviceId}/approve`)).statusCode).toBe(201);
    });

    it('banning revokes access immediately (HTTP and sockets), pauses listings, and cannot target staff or self', async () => {
      const victim = await signUpVerified(app, { name: 'Bad Actor' });
      await publishSeller(call, victim);
      const cats = json<{ id: string }[]>(await call(null, 'GET', '/categories'));
      const svc = json<{ id: string }>(
        await call(victim, 'POST', '/me/services', {
          categoryId: cats[0]!.id,
          title: 'Soon to be banned sellers listing',
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
      await call(victim, 'POST', `/me/services/${svc.id}/submit`);
      await call(ops, 'POST', `/admin/services/${svc.id}/approve`);
      expect(
        json<ServicePageView>(await call(null, 'GET', '/services?limit=50')).items.some(
          (s) => s.id === svc.id,
        ),
      ).toBe(true);
      expect((await call(victim, 'GET', '/me')).statusCode).toBe(200);

      const body = { reason: 'Repeated off-platform payment solicitation.' };
      expect((await call(buyer, 'POST', `/admin/users/${victim.userId}/ban`, body)).statusCode).toBe(403);
      expect((await call(growth, 'POST', `/admin/users/${victim.userId}/ban`, body)).statusCode).toBe(403);
      expect((await call(ops, 'POST', `/admin/users/${ops.userId}/ban`, body)).statusCode).toBe(422);
      expect((await call(ops, 'POST', `/admin/users/${growth.userId}/ban`, body)).statusCode).toBe(403); // staff
      expect((await call(ops, 'POST', `/admin/users/${victim.userId}/ban`, body)).statusCode).toBe(201);

      // the still-"valid" cookie is dead right away
      expect((await call(victim, 'GET', '/me')).statusCode).toBe(401);
      expect((await call(victim, 'POST', '/me/seller')).statusCode).toBe(401);
      expect(
        json<ServicePageView>(await call(null, 'GET', '/services?limit=50')).items.some(
          (s) => s.id === svc.id,
        ),
      ).toBe(false);
      expect(
        (
          await call(
            null,
            'GET',
            `/services/${json<ServiceDetailView>(await call(ops, 'GET', `/admin/services/${svc.id}`)).slug}`,
          )
        ).statusCode,
      ).toBe(404);

      // a fresh sign-in yields a session that is equally useless
      const again = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in/email',
        headers: ORIGIN,
        payload: { email: victim.email, password: 'correct-horse-battery' },
      });
      const cookie = [again.headers['set-cookie']]
        .flat()
        .map((c) => String(c).split(';')[0])
        .join('; ');
      expect((await call({ ...victim, cookie }, 'GET', '/me')).statusCode).toBe(401);

      const logs = json<{ items: { entityId: string }[] }>(
        await call(ops, 'GET', '/admin/audit-logs?action=user.banned'),
      );
      expect(logs.items.some((l) => l.entityId === victim.userId)).toBe(true);

      // unban restores access
      expect(
        (
          await call(ops, 'POST', `/admin/users/${victim.userId}/unban`, {
            reason: 'Appeal accepted after review.',
          })
        ).statusCode,
      ).toBe(201);
      expect((await call({ ...victim, cookie }, 'GET', '/me')).statusCode).toBe(200);
      const [row] = await db.db.select({ b: users.bannedAt }).from(users).where(eq(users.id, victim.userId));
      expect(row!.b).toBeNull();
    });
  });
});
