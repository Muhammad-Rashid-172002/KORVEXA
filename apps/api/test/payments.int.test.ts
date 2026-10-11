import {
  and,
  eq,
  escrowHolds,
  ledgerEntries,
  milestones,
  payments,
  sql,
  webhookEvents,
  type DbClient,
} from '@glasswork/db';
import type { MilestoneView, ProjectView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { PaymentsProvider } from '../src/modules/payments/payments.provider';
import { type TestPaymentsProvider } from '../src/modules/payments/test-payments.provider';
import {
  createTestApp,
  idemKey,
  makeAdmin,
  makeCaller,
  publishSeller,
  signUpVerified,
  type TestUser,
} from './helpers';

const INTERNAL = 'dev-only-internal-token-change-me-0123456789';

describe('Phase 3: orders, escrow, ledger, payouts', () => {
  let app: NestFastifyApplication;
  let db: DbClient;
  let call: ReturnType<typeof makeCaller>;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;
  let ops: TestUser;
  let growth: TestUser;
  let product: TestUser;
  let packageId: string;
  let basicPrice: number;

  const json = <T>(r: { json: () => unknown }) => r.json() as T;

  async function liveService(owner: TestUser, price: number, title: string) {
    const cats = json<{ id: string; slug: string }[]>(await call(null, 'GET', '/categories'));
    const created = await call(owner, 'POST', '/me/services', {
      categoryId: cats[0]!.id,
      title,
      description:
        'A complete production-ready build with tests, CI and clear milestones for every stage of delivery.',
      packages: [
        {
          tier: 'basic',
          title: 'Standard build',
          description: 'Everything included in the build',
          priceAmount: price,
          deliveryDays: 10,
          revisions: 2,
        },
      ],
    });
    const svc = json<{ id: string; packages: { id: string }[] }>(created);
    await call(owner, 'POST', `/me/services/${svc.id}/submit`);
    expect((await call(ops, 'POST', `/admin/services/${svc.id}/approve`)).statusCode).toBe(201);
    return { serviceId: svc.id, packageId: svc.packages[0]!.id };
  }

  async function order(u: TestUser, pkg = packageId, body: Record<string, unknown> = {}) {
    const r = await call(
      u,
      'POST',
      '/orders',
      { packageId: pkg, ...body },
      { 'idempotency-key': idemKey('order') },
    );
    expect(r.statusCode, r.body).toBe(201);
    return json<{ projectId: string; code: string; firstMilestoneId: string }>(r);
  }
  const project = async (u: TestUser, id: string) =>
    json<ProjectView>(await call(u, 'GET', `/projects/${id}`));

  /** Funds a milestone through the simulated checkout (real signed webhook path). */
  async function fund(u: TestUser, milestoneId: string) {
    const r = await call(u, 'POST', `/milestones/${milestoneId}/fund`, undefined, {
      'idempotency-key': idemKey('fund'),
    });
    expect(r.statusCode, r.body).toBe(201);
    const f = json<{ paymentId: string }>(r);
    const sim = await call(u, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
    expect(sim.statusCode, sim.body).toBe(201);
    expect(json<{ status: string }>(sim).status).toBe('succeeded');
    return f.paymentId;
  }
  const trial = async () =>
    json<{
      trialBalance: number;
      cash: number;
      revenue: number;
      escrow: number;
      sellerPayable: number;
      payoutClearing: number;
    }>(await call(ops, 'GET', '/admin/ledger/summary'));

  /** order → fund m1 → accept → returns ids; milestones are 30/40/30 of `price`. */
  async function activeProject(pkg = packageId) {
    const o = await order(buyer, pkg);
    await fund(buyer, o.firstMilestoneId);
    expect((await call(seller, 'POST', `/projects/${o.projectId}/accept`)).statusCode).toBe(201);
    return o;
  }

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DbClient>(DB);
    call = makeCaller(app);
    const users = await Promise.all(
      ['Seller', 'Buyer', 'Other', 'Ops', 'Growth', 'Product'].map((name) => signUpVerified(app, { name })),
    );
    [seller, buyer, other, ops, growth, product] = users as [
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
    ];
    await makeAdmin(app, ops, ['operations']);
    await makeAdmin(app, growth, ['growth']);
    await makeAdmin(app, product, ['product']);
    await publishSeller(call, seller);
    basicPrice = 100_001; // deliberately not divisible: exercises exact splitting
    ({ packageId } = await liveService(seller, basicPrice, 'Payments flow test service listing'));
  });
  afterAll(async () => {
    await app?.close();
  });

  describe('orders', () => {
    it('requires auth and an Idempotency-Key', async () => {
      expect((await call(null, 'POST', '/orders', { packageId })).statusCode).toBe(401);
      expect((await call(buyer, 'POST', '/orders', { packageId })).statusCode).toBe(400);
      expect(
        (await call(buyer, 'POST', '/orders', { packageId }, { 'idempotency-key': 'short' })).statusCode,
      ).toBe(400);
    });

    it('rejects ordering your own service and unknown packages', async () => {
      const own = await call(seller, 'POST', '/orders', { packageId }, { 'idempotency-key': idemKey() });
      expect(own.statusCode).toBe(422);
      const unknown = await call(
        buyer,
        'POST',
        '/orders',
        { packageId: uuidv7() },
        { 'idempotency-key': idemKey() },
      );
      expect(unknown.statusCode).toBe(404);
    });

    it('creates a project with 3 milestones that sum exactly to the DB price, ignoring client-sent amounts', async () => {
      const o = await order(buyer, packageId, { amount: 1, totalAmount: 1, price: 1 });
      const p = await project(buyer, o.projectId);
      expect(p.totalAmount).toBe(basicPrice);
      expect(p.milestones.map((m) => m.amount)).toEqual([30_000, 40_000, 30_001]);
      expect(p.milestones.reduce((s, m) => s + m.amount, 0)).toBe(basicPrice);
      expect(p.status).toBe('requirements_submitted');
      expect(p.code).toMatch(/^GW-\d{4}$/);
      expect(p.milestones[0]!.actions).toEqual(['fund']);
      expect(p.milestones[1]!.actions).toEqual([]); // later milestones need an accepted project
    });

    it('is idempotent: same key+body replays, same key with another body is rejected', async () => {
      const key = idemKey('replay');
      const a = await call(buyer, 'POST', '/orders', { packageId }, { 'idempotency-key': key });
      const b = await call(buyer, 'POST', '/orders', { packageId }, { 'idempotency-key': key });
      expect(json<{ projectId: string }>(a).projectId).toBe(json<{ projectId: string }>(b).projectId);
      const c = await call(
        buyer,
        'POST',
        '/orders',
        { packageId, notes: 'different' },
        { 'idempotency-key': key },
      );
      expect(c.statusCode).toBe(422);
    });

    it('only participants can see a project; everyone else gets 404', async () => {
      const o = await order(buyer);
      expect((await call(seller, 'GET', `/projects/${o.projectId}`)).statusCode).toBe(200);
      expect((await call(other, 'GET', `/projects/${o.projectId}`)).statusCode).toBe(404);
      expect((await call(null, 'GET', `/projects/${o.projectId}`)).statusCode).toBe(401);
      const list = json<{ items: { id: string }[] }>(await call(other, 'GET', '/projects'));
      expect(list.items.some((i) => i.id === o.projectId)).toBe(false);
    });
  });

  describe('funding & webhooks', () => {
    it('only the buyer funds; funding runs through a signed webhook into escrow with a balanced ledger', async () => {
      const o = await order(buyer);
      const m1 = o.firstMilestoneId;
      expect(
        (await call(other, 'POST', `/milestones/${m1}/fund`, undefined, { 'idempotency-key': idemKey() }))
          .statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/milestones/${m1}/fund`, undefined, { 'idempotency-key': idemKey() }))
          .statusCode,
      ).toBe(404);
      expect((await call(buyer, 'POST', `/milestones/${m1}/fund`)).statusCode).toBe(400);

      const before = await trial();
      const r = await call(buyer, 'POST', `/milestones/${m1}/fund`, undefined, {
        'idempotency-key': idemKey('fund'),
      });
      const f = json<{ paymentId: string; checkoutUrl: string; quote: { buyerTotal: number } }>(r);
      expect(f.checkoutUrl).toContain(`/pay/test/${f.paymentId}`);

      // Re-opening the checkout with a NEW key never creates a second charge.
      const again = await call(buyer, 'POST', `/milestones/${m1}/fund`, undefined, {
        'idempotency-key': idemKey('fund'),
      });
      expect(json<{ paymentId: string }>(again).paymentId).toBe(f.paymentId);

      // Not paid yet: nothing is funded, ledger untouched.
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('pending');
      expect((await trial()).cash).toBe(before.cash);

      // Only the payer can complete their own simulated checkout.
      expect(
        (await call(other, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' })).statusCode,
      ).toBe(404);
      const sim = await call(buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
      expect(sim.statusCode).toBe(201);

      const p = await project(buyer, o.projectId);
      expect(p.milestones[0]!.status).toBe('funded');
      expect(p.escrow.held).toBe(30_000);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(after.cash - before.cash).toBe(30_000);
      expect(after.escrow - before.escrow).toBe(30_000);
    });

    it('later milestones cannot be funded before the seller accepts; accept needs milestone 1 funded', async () => {
      const o = await order(buyer);
      const p0 = await project(buyer, o.projectId);
      const m2 = p0.milestones[1]!.id;
      expect(
        (await call(buyer, 'POST', `/milestones/${m2}/fund`, undefined, { 'idempotency-key': idemKey() }))
          .statusCode,
      ).toBe(422);
      expect((await call(seller, 'POST', `/projects/${o.projectId}/accept`)).statusCode).toBe(422);
      await fund(buyer, o.firstMilestoneId);
      expect((await call(buyer, 'POST', `/projects/${o.projectId}/accept`)).statusCode).toBe(404); // buyers can't accept
      expect((await call(other, 'POST', `/projects/${o.projectId}/accept`)).statusCode).toBe(404);
      expect((await call(seller, 'POST', `/projects/${o.projectId}/accept`)).statusCode).toBe(201);
      const p1 = await project(buyer, o.projectId);
      expect(p1.status).toBe('active');
      expect(p1.milestones[1]!.actions).toEqual(['fund']);
    });

    it('a failed payment leaves the milestone pending and can be retried', async () => {
      const o = await order(buyer);
      const r = await call(buyer, 'POST', `/milestones/${o.firstMilestoneId}/fund`, undefined, {
        'idempotency-key': idemKey(),
      });
      const pid = json<{ paymentId: string }>(r).paymentId;
      await call(buyer, 'POST', `/payments/${pid}/simulate`, { outcome: 'failed' });
      expect(json<{ status: string }>(await call(buyer, 'GET', `/payments/${pid}`)).status).toBe('failed');
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('pending');
      await fund(buyer, o.firstMilestoneId); // retry works
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('funded');
    });

    it('webhook security: bad/missing/stale signatures and wrong provider are rejected; nothing is trusted unsigned', async () => {
      const o = await order(buyer);
      const r = await call(buyer, 'POST', `/milestones/${o.firstMilestoneId}/fund`, undefined, {
        'idempotency-key': idemKey(),
      });
      const paymentId = json<{ paymentId: string }>(r).paymentId;
      const provider = app.get(PaymentsProvider) as TestPaymentsProvider;
      const body = JSON.stringify({
        id: `evt_${uuidv7()}`,
        type: 'payment.succeeded',
        paymentId,
        amount: 30_000,
      });
      const post = (b: string, sig?: string, path = '/webhooks/test') =>
        app.inject({
          method: 'POST',
          url: `/v1${path}`,
          headers: { 'content-type': 'application/json', ...(sig && { 'x-test-signature': sig }) },
          payload: b,
        });

      expect((await post(body)).statusCode).toBe(400); // no signature
      expect((await post(body, 't=1,v1=deadbeef')).statusCode).toBe(400); // garbage
      expect((await post(body, provider.sign(body, Math.floor(Date.now() / 1000) - 3600))).statusCode).toBe(
        400,
      ); // stale
      const tampered = body.replace('30000', '1');
      expect((await post(tampered, provider.sign(body))).statusCode).toBe(400); // signature for a different body
      expect((await post(body, provider.sign(body), '/webhooks/stripe')).statusCode).toBe(404); // wrong provider
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('pending');
      const stored = await db.db.select().from(webhookEvents);
      expect(stored.some((e) => e.eventId === JSON.parse(body).id)).toBe(false); // rejected events are never stored

      expect((await post(body, provider.sign(body))).statusCode).toBe(201); // valid → funded
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('funded');
    });

    it('duplicate and concurrent deliveries of the same event fund once', async () => {
      const o = await order(buyer);
      const r = await call(buyer, 'POST', `/milestones/${o.firstMilestoneId}/fund`, undefined, {
        'idempotency-key': idemKey(),
      });
      const paymentId = json<{ paymentId: string }>(r).paymentId;
      const provider = app.get(PaymentsProvider) as TestPaymentsProvider;
      const body = JSON.stringify({
        id: `evt_${uuidv7()}`,
        type: 'payment.succeeded',
        paymentId,
        amount: 30_000,
      });
      const send = () =>
        app.inject({
          method: 'POST',
          url: '/v1/webhooks/test',
          headers: { 'content-type': 'application/json', 'x-test-signature': provider.sign(body) },
          payload: body,
        });
      const results = await Promise.all([send(), send(), send()]);
      expect(results.every((x) => x.statusCode === 201)).toBe(true);
      const holds = await db.db.select().from(escrowHolds).where(eq(escrowHolds.paymentId, paymentId));
      expect(holds).toHaveLength(1);
      const entries = await db.db.execute<{ n: string }>(
        sql`select count(*)::text n from ledger_transactions where idempotency_key = ${'charge:' + paymentId}`,
      );
      expect(entries.rows[0]!.n).toBe('1');
      expect((await trial()).trialBalance).toBe(0);
    });

    it('a charge for the wrong amount is NOT funded, is recorded as failed, and can be replayed after review', async () => {
      const o = await order(buyer);
      const r = await call(buyer, 'POST', `/milestones/${o.firstMilestoneId}/fund`, undefined, {
        'idempotency-key': idemKey(),
      });
      const paymentId = json<{ paymentId: string }>(r).paymentId;
      const provider = app.get(PaymentsProvider) as TestPaymentsProvider;
      const body = JSON.stringify({
        id: `evt_${uuidv7()}`,
        type: 'payment.succeeded',
        paymentId,
        amount: 12_345,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/test',
        headers: { 'content-type': 'application/json', 'x-test-signature': provider.sign(body) },
        payload: body,
      });
      expect(res.statusCode).toBe(500);
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('pending');
      const failed = json<{ id: string; error: string }[]>(
        await call(ops, 'GET', '/admin/webhook-events?failed=true'),
      );
      const ev = failed.find((e) => e.error?.includes('expected 30000'));
      expect(ev).toBeTruthy();
      // Non-ops admins can't replay.
      expect((await call(growth, 'POST', `/admin/webhook-events/${ev!.id}/replay`)).statusCode).toBe(403);
      expect((await call(ops, 'POST', `/admin/webhook-events/${ev!.id}/replay`)).statusCode).toBe(500); // still wrong amount
    });

    it('invoices: receipt PDF per payment, visible only to the payer', async () => {
      const o = await order(buyer);
      await fund(buyer, o.firstMilestoneId);
      const list = json<{ id: string; number: string; totalAmount: number }[]>(
        await call(buyer, 'GET', '/me/invoices'),
      );
      expect(list.length).toBeGreaterThan(0);
      const inv = list[0]!;
      expect(inv.number).toMatch(/^GW-INV-\d{4}-\d{6}$/);
      const pdf = await call(buyer, 'GET', `/invoices/${inv.id}/pdf`);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
      expect((await call(other, 'GET', `/invoices/${inv.id}/pdf`)).statusCode).toBe(404);
      expect((await call(null, 'GET', `/invoices/${inv.id}/pdf`)).statusCode).toBe(401);
      expect(json<unknown[]>(await call(other, 'GET', '/me/invoices'))).toHaveLength(0);
    });
  });

  describe('fees', () => {
    it('only product admins change fee settings; invalid values are rejected; changes are audited', async () => {
      const settings = {
        buyerServiceBps: 500,
        buyerServiceMin: 0,
        sellerCommissionBps: 1000,
        sellerCommissionMin: 0,
        autoApproveDays: 5,
      };
      expect((await call(null, 'PUT', '/admin/settings/fees', settings)).statusCode).toBe(401);
      expect((await call(seller, 'PUT', '/admin/settings/fees', settings)).statusCode).toBe(403);
      expect((await call(ops, 'PUT', '/admin/settings/fees', settings)).statusCode).toBe(403);
      expect(
        (await call(product, 'PUT', '/admin/settings/fees', { ...settings, buyerServiceBps: 20_000 }))
          .statusCode,
      ).toBe(400);
      expect(
        (await call(product, 'PUT', '/admin/settings/fees', { ...settings, autoApproveDays: 0 })).statusCode,
      ).toBe(400);
      expect((await call(product, 'PUT', '/admin/settings/fees', settings)).statusCode).toBe(200);
      const logs = json<{ items: { action: string }[] }>(
        await call(product, 'GET', '/admin/audit-logs?action=settings.fees_changed'),
      );
      expect(logs.items.length).toBeGreaterThan(0);
      const q = json<{ buyerFee: number; buyerTotal: number; sellerCommission: number; sellerNet: number }>(
        await call(null, 'GET', '/fees/quote?amount=10000'),
      );
      expect(q).toMatchObject({
        buyerFee: 500,
        buyerTotal: 10_500,
        sellerCommission: 1_000,
        sellerNet: 9_000,
      });
    });
  });

  describe('milestone lifecycle, release and ledger', () => {
    it('runs a 3-milestone project end to end with 5% buyer fee and 10% commission; the books balance at every step', async () => {
      const ledgerBefore = await trial();
      const o = await activeProject();
      const p0 = await project(buyer, o.projectId);
      const [m1, m2, m3] = p0.milestones as [MilestoneView, MilestoneView, MilestoneView];
      expect(m1.quote).toMatchObject({
        amount: 30_000,
        buyerFee: 1_500,
        buyerTotal: 31_500,
        sellerCommission: 3_000,
        sellerNet: 27_000,
      });
      expect(p0.progress).toBe(0);

      // wrong actors / wrong order
      expect((await call(buyer, 'POST', `/milestones/${m1.id}/start`)).statusCode).toBe(422);
      expect((await call(other, 'POST', `/milestones/${m1.id}/start`)).statusCode).toBe(404);
      expect((await call(seller, 'POST', `/milestones/${m1.id}/submit`, {})).statusCode).toBe(422); // not started
      expect((await call(buyer, 'POST', `/milestones/${m1.id}/approve`)).statusCode).toBe(422); // not submitted

      // m1: start → submit → revision → resubmit → approve → released
      expect((await call(seller, 'POST', `/milestones/${m1.id}/start`)).statusCode).toBe(201);
      expect(
        (await call(seller, 'POST', `/milestones/${m1.id}/submit`, { note: 'First cut' })).statusCode,
      ).toBe(201);
      expect((await call(seller, 'POST', `/milestones/${m1.id}/approve`)).statusCode).toBe(422);
      expect(
        (await call(buyer, 'POST', `/milestones/${m1.id}/request-revision`, { note: 'x' })).statusCode,
      ).toBe(400);
      const rev = await call(buyer, 'POST', `/milestones/${m1.id}/request-revision`, {
        note: 'Please fix the header',
      });
      expect(json<ProjectView>(rev).milestones[0]).toMatchObject({
        status: 'revision_requested',
        revisionCount: 1,
      });
      expect((await call(seller, 'POST', `/milestones/${m1.id}/submit`, {})).statusCode).toBe(201);
      const mid = await trial();
      expect(mid.escrow - ledgerBefore.escrow).toBe(31_500 - 1_500); // 30,000 held, buyer fee already revenue
      const approved = json<ProjectView>(await call(buyer, 'POST', `/milestones/${m1.id}/approve`));
      expect(approved.milestones[0]!.status).toBe('released');
      expect(approved.progress).toBeCloseTo(30, 0);

      let t = await trial();
      expect(t.trialBalance).toBe(0);
      expect(t.sellerPayable - ledgerBefore.sellerPayable).toBe(27_000);
      expect(t.revenue - ledgerBefore.revenue).toBe(1_500 + 3_000);
      expect((await call(buyer, 'POST', `/milestones/${m1.id}/approve`)).statusCode).toBe(422); // no double release

      // m2 and m3
      for (const m of [m2, m3]) {
        await fund(buyer, m.id);
        await call(seller, 'POST', `/milestones/${m.id}/start`);
        await call(seller, 'POST', `/milestones/${m.id}/submit`, { note: 'done' });
        expect((await call(buyer, 'POST', `/milestones/${m.id}/approve`)).statusCode).toBe(201);
      }
      const done = await project(buyer, o.projectId);
      expect(done.status).toBe('completed');
      expect(done.progress).toBe(100);
      expect(done.escrow).toEqual({ held: 0, released: basicPrice });
      expect(done.completedAt).not.toBeNull();

      t = await trial();
      expect(t.trialBalance).toBe(0);
      // seller got price − 10%; platform kept buyer fee + commission on every milestone
      const net = [30_000, 40_000, 30_001].reduce((s, a) => s + (a - Math.round(a * 0.1)), 0);
      expect(t.sellerPayable - ledgerBefore.sellerPayable).toBe(net);
      expect(t.escrow).toBe(ledgerBefore.escrow);
      expect(done.milestones.every((m) => m.status === 'released')).toBe(true);

      // activity feed + audit trail exist for every transition
      const evs = await db.db.execute<{ type: string }>(
        sql`select type from project_events where project_id = ${o.projectId} order by id`,
      );
      const types = evs.rows.map((e) => e.type);
      expect(types).toEqual(
        expect.arrayContaining([
          'project.ordered',
          'milestone.funded',
          'project.accepted',
          'milestone.started',
          'milestone.submitted',
          'milestone.revision_requested',
          'milestone.approved',
          'milestone.released',
          'project.completed',
        ]),
      );
    });

    it('concurrent approvals release exactly once', async () => {
      const o = await activeProject();
      const m1 = (await project(buyer, o.projectId)).milestones[0]!.id;
      await call(seller, 'POST', `/milestones/${m1}/start`);
      await call(seller, 'POST', `/milestones/${m1}/submit`, {});
      const before = await trial();
      const res = await Promise.all([1, 2, 3].map(() => call(buyer, 'POST', `/milestones/${m1}/approve`)));
      expect(res.filter((r) => r.statusCode === 201)).toHaveLength(1);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(after.sellerPayable - before.sellerPayable).toBe(27_000);
    });

    it('auto-approve: internal token required, not-due and paused projects are skipped, due ones release once', async () => {
      const o = await activeProject();
      const m1 = (await project(buyer, o.projectId)).milestones[0]!.id;
      await call(seller, 'POST', `/milestones/${m1}/start`);
      await call(seller, 'POST', `/milestones/${m1}/submit`, {});
      const hit = (token?: string) =>
        call(
          null,
          'POST',
          `/internal/milestones/${m1}/auto-approve`,
          undefined,
          token ? { 'x-internal-token': token } : {},
        );

      expect((await hit()).statusCode).toBe(403);
      expect((await hit('wrong-token-wrong-token-wrong')).statusCode).toBe(403);
      expect(json<{ result: string; reason?: string }>(await hit(INTERNAL))).toMatchObject({
        result: 'skipped',
        reason: 'not due yet',
      });

      await db.db
        .update(milestones)
        .set({ autoApproveAt: new Date(Date.now() - 1000) })
        .where(eq(milestones.id, m1));
      await db.db.execute(sql`update projects set status = 'paused' where id = ${o.projectId}`);
      expect(json<{ result: string; reason?: string }>(await hit(INTERNAL))).toMatchObject({
        result: 'skipped',
        reason: 'project is paused',
      });
      await db.db.execute(sql`update projects set status = 'active' where id = ${o.projectId}`);

      const before = await trial();
      const [a, b] = await Promise.all([hit(INTERNAL), hit(INTERNAL)]);
      const results = [json<{ result: string }>(a).result, json<{ result: string }>(b).result].sort();
      expect(results).toEqual(['approved', 'skipped']);
      expect((await project(buyer, o.projectId)).milestones[0]!.status).toBe('released');
      expect((await trial()).sellerPayable - before.sellerPayable).toBe(27_000);
      expect(json<{ result: string }>(await hit(INTERNAL)).result).toBe('skipped'); // idempotent
    });
  });

  describe('refunds and declines', () => {
    it('declining an order refunds the funded milestone in full and cancels the project', async () => {
      const o = await order(buyer);
      await fund(buyer, o.firstMilestoneId);
      const before = await trial();
      expect(
        (await call(other, 'POST', `/projects/${o.projectId}/decline`, { reason: 'nope nope' })).statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/projects/${o.projectId}/decline`, { reason: 'x' })).statusCode,
      ).toBe(400);
      const res = await call(seller, 'POST', `/projects/${o.projectId}/decline`, {
        reason: 'Cannot take this on',
      });
      expect(res.statusCode).toBe(201);
      const p = json<ProjectView>(res);
      expect(p.status).toBe('cancelled');
      expect(p.milestones.map((m) => m.status)).toEqual(['refunded', 'cancelled', 'cancelled']);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(before.cash - after.cash).toBe(31_500);
      expect(before.escrow - after.escrow).toBe(30_000);
      expect(before.revenue - after.revenue).toBe(1_500); // buyer fee returned too
      const pay = await db.db.select().from(payments).where(eq(payments.milestoneId, o.firstMilestoneId));
      expect(pay[0]!.status).toBe('refunded');
      expect(
        (await call(seller, 'POST', `/projects/${o.projectId}/decline`, { reason: 'Again again' }))
          .statusCode,
      ).toBe(422);
    });

    it('admin refunds a funded milestone only with the operations/product scope; started work cannot be refunded', async () => {
      const o = await activeProject();
      const p = await project(buyer, o.projectId);
      const m2 = p.milestones[1]!.id;
      await fund(buyer, m2);
      const body = { reason: 'Seller unresponsive' };
      expect((await call(null, 'POST', `/admin/milestones/${m2}/refund`, body)).statusCode).toBe(401);
      expect((await call(buyer, 'POST', `/admin/milestones/${m2}/refund`, body)).statusCode).toBe(403);
      expect((await call(growth, 'POST', `/admin/milestones/${m2}/refund`, body)).statusCode).toBe(403);
      const before = await trial();
      expect((await call(ops, 'POST', `/admin/milestones/${m2}/refund`, body)).statusCode).toBe(201);
      expect((await project(buyer, o.projectId)).milestones[1]!.status).toBe('refunded');
      expect((await trial()).trialBalance).toBe(0);
      expect(before.cash - (await trial()).cash).toBe(42_000); // 40,000 + 5% fee
      expect((await call(ops, 'POST', `/admin/milestones/${m2}/refund`, body)).statusCode).toBe(422); // already refunded

      const m1 = p.milestones[0]!.id;
      await call(seller, 'POST', `/milestones/${m1}/start`);
      expect((await call(ops, 'POST', `/admin/milestones/${m1}/refund`, body)).statusCode).toBe(422); // in progress: needs a dispute (Phase 5)
    });
  });

  describe('earnings & payouts', () => {
    let payoutSeller: TestUser;
    let payoutBuyer: TestUser;
    let pkg: string;

    beforeAll(async () => {
      payoutSeller = await signUpVerified(app, { name: 'Payout Seller' });
      payoutBuyer = await signUpVerified(app, { name: 'Payout Buyer' });
      await publishSeller(call, payoutSeller);
      ({ packageId: pkg } = await liveService(payoutSeller, 100_000, 'Payout flow test service listing'));
      // earn: one released milestone (30,000 − 10% = 27,000)
      const o = await order(payoutBuyer, pkg);
      await fund(payoutBuyer, o.firstMilestoneId);
      await call(payoutSeller, 'POST', `/projects/${o.projectId}/accept`);
      await call(payoutSeller, 'POST', `/milestones/${o.firstMilestoneId}/start`);
      await call(payoutSeller, 'POST', `/milestones/${o.firstMilestoneId}/submit`, {});
      await call(payoutBuyer, 'POST', `/milestones/${o.firstMilestoneId}/approve`);
    });

    const earnings = async () =>
      json<{
        available: number;
        pendingPayout: number;
        paidOut: number;
        inEscrow: number;
        transfers: unknown[];
      }>(await call(payoutSeller, 'GET', '/me/earnings'));
    const reqPayout = (amount: number | undefined, key = idemKey('payout')) =>
      call(payoutSeller, 'POST', '/me/payouts', amount === undefined ? {} : { amount }, {
        'idempotency-key': key,
      });

    it('shows only the seller’s own balances; buyers without the seller role are refused', async () => {
      const e = await earnings();
      expect(e).toMatchObject({ available: 27_000, pendingPayout: 0, paidOut: 0 });
      expect(e.transfers).toHaveLength(1);
      expect((await call(payoutBuyer, 'GET', '/me/earnings')).statusCode).toBe(403);
      expect((await call(null, 'GET', '/me/earnings')).statusCode).toBe(401);
      expect(
        (await call(payoutBuyer, 'POST', '/me/payouts', {}, { 'idempotency-key': idemKey() })).statusCode,
      ).toBe(403);
    });

    it('validates amounts, serialises concurrent requests, and is idempotent', async () => {
      expect((await reqPayout(500)).statusCode).toBe(422); // below minimum
      expect((await reqPayout(27_001)).statusCode).toBe(422); // above balance
      expect((await call(payoutSeller, 'POST', '/me/payouts', {})).statusCode).toBe(400); // no key

      const key = idemKey('same');
      const results = await Promise.all([
        reqPayout(undefined),
        reqPayout(undefined),
        reqPayout(10_000, key),
        reqPayout(10_000, key),
      ]);
      // Whatever interleaving: the reserved total can never exceed the balance, and the books balance.
      const e = await earnings();
      expect(e.available + e.pendingPayout).toBe(27_000);
      expect(e.available).toBeGreaterThanOrEqual(0);
      expect(results.filter((r) => r.statusCode === 201).length).toBeGreaterThanOrEqual(1);
      expect((await trial()).trialBalance).toBe(0);
    });

    it('operations marks payouts paid (reference required) or failed (balance returns); each only once', async () => {
      const list = json<{ id: string; status: string; amount: number }[]>(
        await call(ops, 'GET', '/admin/payouts?status=requested'),
      );
      const mine = list.filter((p) => p.status === 'requested');
      expect(mine.length).toBeGreaterThan(0);
      const target = mine[0]!;
      expect(
        (await call(payoutSeller, 'POST', `/admin/payouts/${target.id}/mark-paid`, { reference: 'BANK-1' }))
          .statusCode,
      ).toBe(403);
      expect(
        (await call(growth, 'POST', `/admin/payouts/${target.id}/mark-paid`, { reference: 'BANK-1' }))
          .statusCode,
      ).toBe(403);
      expect((await call(ops, 'POST', `/admin/payouts/${target.id}/mark-paid`, {})).statusCode).toBe(422);

      const cashBefore = (await trial()).cash;
      expect(
        (await call(ops, 'POST', `/admin/payouts/${target.id}/mark-paid`, { reference: 'BANK-REF-123' }))
          .statusCode,
      ).toBe(201);
      expect(cashBefore - (await trial()).cash).toBe(target.amount);
      expect(
        (await call(ops, 'POST', `/admin/payouts/${target.id}/mark-paid`, { reference: 'BANK-REF-123' }))
          .statusCode,
      ).toBe(422);

      const others = mine.slice(1);
      if (others.length) {
        const before = await earnings();
        expect(
          (await call(ops, 'POST', `/admin/payouts/${others[0]!.id}/mark-failed`, { note: 'Bank rejected' }))
            .statusCode,
        ).toBe(201);
        const after = await earnings();
        expect(after.available - before.available).toBe(others[0]!.amount); // reservation returned
      }
      const e = await earnings();
      expect(e.paidOut).toBe(target.amount);
      expect((await trial()).trialBalance).toBe(0);
    });
  });

  describe('database-level guarantees', () => {
    /** Drizzle wraps driver errors ("Failed query: …"); the Postgres message lives in `cause`. */
    const dbError = async (p: Promise<unknown>) => {
      try {
        await p;
      } catch (e) {
        const err = e as Error & { cause?: Error };
        return `${err.message} | ${err.cause?.message ?? ''}`;
      }
      return 'NO ERROR';
    };

    it('refuses an unbalanced ledger transaction at commit and blocks UPDATE/DELETE on the ledger', async () => {
      const txId = uuidv7();
      const acct = await db.db.execute<{ id: string }>(sql`select id from ledger_accounts limit 1`);
      const accountId = acct.rows[0]!.id;
      expect(
        await dbError(
          db.db.transaction(async (tx) => {
            await tx.execute(
              sql`insert into ledger_transactions (id, kind, reference_type, idempotency_key) values (${txId}, 'test', 'test', ${'bad:' + txId})`,
            );
            await tx.execute(
              sql`insert into ledger_entries (id, transaction_id, account_id, amount, currency) values (${uuidv7()}, ${txId}, ${accountId}, 100, 'USD')`,
            );
          }),
        ),
      ).toMatch(/does not balance/);

      const some = await db.db.select({ id: ledgerEntries.id }).from(ledgerEntries).limit(1);
      expect(
        await dbError(db.db.execute(sql`update ledger_entries set amount = 1 where id = ${some[0]!.id}`)),
      ).toMatch(/append-only/);
      expect(await dbError(db.db.execute(sql`delete from ledger_entries where id = ${some[0]!.id}`))).toMatch(
        /append-only/,
      );
      expect(await dbError(db.db.execute(sql`delete from ledger_transactions`))).toMatch(/append-only/);
      expect(await dbError(db.db.execute(sql`delete from project_events`))).toMatch(/append-only/);
    });

    it('keeps global invariants: ledger sums to zero; escrow account totals equal held funds', async () => {
      const t = await trial();
      expect(t.trialBalance).toBe(0);
      const held = await db.db
        .select({ total: sql<string>`coalesce(sum(${escrowHolds.amount}), 0)::text` })
        .from(escrowHolds)
        .where(and(eq(escrowHolds.status, 'held')));
      expect(t.escrow).toBe(Number(held[0]!.total));
      expect(t.cash).toBe(t.escrow + t.sellerPayable + t.payoutClearing + t.revenue);
    });
  });
});
