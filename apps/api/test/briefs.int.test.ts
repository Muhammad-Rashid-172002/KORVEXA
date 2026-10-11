import type { BriefView, ProjectView, ProposalView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, idemKey, makeCaller, publishSeller, signUpVerified, type TestUser } from './helpers';

describe('Phase 3: requests board & proposals', () => {
  let app: NestFastifyApplication;
  let call: ReturnType<typeof makeCaller>;
  let buyer: TestUser;
  let other: TestUser;
  let sellerA: TestUser;
  let sellerB: TestUser;
  let unpublished: TestUser;
  const json = <T>(r: { json: () => unknown }) => r.json() as T;

  const brief = (over: Record<string, unknown> = {}) => ({
    title: 'Build me a booking app',
    description:
      'We need a mobile and web booking app with payments, reminders and an admin dashboard for staff.',
    budgetMinAmount: 200_000,
    budgetMaxAmount: 500_000,
    ...over,
  });
  const plan = (amounts = [100_000, 150_000, 100_000]) =>
    amounts.map((amount, i) => ({ title: `Milestone ${i + 1}`, amount, days: 7 * (i + 1) }));
  const proposal = (over: Record<string, unknown> = {}) => ({
    coverLetter: 'I have shipped three booking apps and can start next week with a clear plan.',
    milestonePlan: plan(),
    ...over,
  });

  beforeAll(async () => {
    app = await createTestApp();
    call = makeCaller(app);
    const users = await Promise.all(
      ['Buyer', 'Other', 'SellerA', 'SellerB', 'Unpublished'].map((name) => signUpVerified(app, { name })),
    );
    [buyer, other, sellerA, sellerB, unpublished] = users as [
      TestUser,
      TestUser,
      TestUser,
      TestUser,
      TestUser,
    ];
    await publishSeller(call, sellerA);
    await publishSeller(call, sellerB);
    await call(unpublished, 'POST', '/me/seller'); // seller role but not onboarded
  });
  afterAll(async () => {
    await app?.close();
  });

  async function openBrief(over: Record<string, unknown> = {}) {
    const r = await call(buyer, 'POST', '/briefs', brief(over));
    expect(r.statusCode, r.body).toBe(201);
    return json<BriefView>(r);
  }

  it('requires auth and validates the request', async () => {
    expect((await call(null, 'POST', '/briefs', brief())).statusCode).toBe(401);
    expect((await call(buyer, 'POST', '/briefs', brief({ title: 'x' }))).statusCode).toBe(400);
    expect(
      (await call(buyer, 'POST', '/briefs', brief({ budgetMinAmount: 9, budgetMaxAmount: 1 }))).statusCode,
    ).toBe(400);
    const b = await openBrief();
    expect(b).toMatchObject({ status: 'open', isOwner: true, proposalCount: 0 });
  });

  it('only published sellers browse the board; visibility rules hold for others', async () => {
    const b = await openBrief({ title: 'Unique quokka logistics platform request' });
    expect((await call(null, 'GET', '/briefs')).statusCode).toBe(401);
    expect((await call(other, 'GET', '/briefs')).statusCode).toBe(422);
    expect((await call(unpublished, 'GET', '/briefs')).statusCode).toBe(422);

    const board = json<{ items: BriefView[] }>(await call(sellerA, 'GET', '/briefs?q=quokka'));
    expect(board.items.map((i) => i.id)).toEqual([b.id]);
    expect(board.items[0]!.proposals).toBeNull();

    expect((await call(sellerA, 'GET', `/briefs/${b.id}`)).statusCode).toBe(200);
    expect((await call(other, 'GET', `/briefs/${b.id}`)).statusCode).toBe(404);
    expect((await call(unpublished, 'GET', `/briefs/${b.id}`)).statusCode).toBe(404);
    expect(json<BriefView[]>(await call(other, 'GET', '/me/briefs'))).toHaveLength(0);
  });

  it('proposals: server-computed total, one active per seller, not on your own or closed requests', async () => {
    const b = await openBrief();
    expect((await call(buyer, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(422); // not a published seller
    expect((await call(other, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(422);
    expect((await call(unpublished, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(422);
    expect(
      (await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal({ coverLetter: 'short' })))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call(
          sellerA,
          'POST',
          `/briefs/${b.id}/proposals`,
          proposal({ milestonePlan: plan([100, 200]) }),
        )
      ).statusCode,
    ).toBe(400); // below min per milestone

    const ok = await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal({ totalAmount: 1 }));
    expect(ok.statusCode).toBe(201);
    expect(json<ProposalView>(ok).totalAmount).toBe(350_000);
    expect((await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(409);

    // a second seller sees only their own proposal; the owner sees both
    await call(
      sellerB,
      'POST',
      `/briefs/${b.id}/proposals`,
      proposal({ milestonePlan: plan([120_000, 120_000]) }),
    );
    const asB = json<BriefView>(await call(sellerB, 'GET', `/briefs/${b.id}`));
    expect(asB.proposals).toBeNull();
    expect(asB.myProposal?.seller.name).toBe('SellerB');
    const asOwner = json<BriefView>(await call(buyer, 'GET', `/briefs/${b.id}`));
    expect(asOwner.proposals?.map((p) => p.seller.name).sort()).toEqual(['SellerA', 'SellerB']);
    expect(asOwner.proposalCount).toBe(2);

    expect(
      (
        await call(buyer, 'POST', '/briefs', brief()).then((r) =>
          call(buyer, 'POST', `/briefs/${json<BriefView>(r).id}/proposals`, proposal()),
        )
      ).statusCode,
    ).toBe(422); // own request

    await call(buyer, 'POST', `/briefs/${b.id}/close`);
    expect((await call(sellerB, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(404);
    expect((await call(other, 'POST', `/briefs/${b.id}/close`)).statusCode).toBe(404);
  });

  it('withdraw and decline are role-scoped', async () => {
    const b = await openBrief();
    const p = json<ProposalView>(await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal()));
    expect((await call(sellerB, 'POST', `/proposals/${p.id}/withdraw`)).statusCode).toBe(404);
    expect((await call(other, 'POST', `/proposals/${p.id}/decline`)).statusCode).toBe(404);
    expect((await call(sellerA, 'POST', `/proposals/${p.id}/decline`)).statusCode).toBe(404); // sellers can't decline themselves
    expect(json<ProposalView>(await call(sellerA, 'POST', `/proposals/${p.id}/withdraw`)).status).toBe(
      'withdrawn',
    );
    expect((await call(sellerA, 'POST', `/proposals/${p.id}/withdraw`)).statusCode).toBe(422);
    // withdrawn frees the slot for a new proposal
    expect((await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal())).statusCode).toBe(201);
    expect(json<ProposalView[]>(await call(sellerA, 'GET', '/me/proposals')).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('accepting a proposal creates the project with the proposed plan, closes the request and funds like any order', async () => {
    const b = await openBrief();
    const a = json<ProposalView>(await call(sellerA, 'POST', `/briefs/${b.id}/proposals`, proposal()));
    const bb = json<ProposalView>(
      await call(
        sellerB,
        'POST',
        `/briefs/${b.id}/proposals`,
        proposal({ milestonePlan: plan([120_000, 120_000]) }),
      ),
    );

    const key = idemKey('accept');
    expect(
      (await call(other, 'POST', `/proposals/${a.id}/accept`, undefined, { 'idempotency-key': key }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(sellerA, 'POST', `/proposals/${a.id}/accept`, undefined, { 'idempotency-key': key }))
        .statusCode,
    ).toBe(404);
    expect((await call(buyer, 'POST', `/proposals/${a.id}/accept`)).statusCode).toBe(400); // key required

    const res = await call(buyer, 'POST', `/proposals/${a.id}/accept`, undefined, { 'idempotency-key': key });
    expect(res.statusCode, res.body).toBe(201);
    const created = json<{ projectId: string; firstMilestoneId: string }>(res);
    const replay = json<{ projectId: string }>(
      await call(buyer, 'POST', `/proposals/${a.id}/accept`, undefined, { 'idempotency-key': key }),
    );
    expect(replay.projectId).toBe(created.projectId);
    expect(
      (
        await call(buyer, 'POST', `/proposals/${a.id}/accept`, undefined, {
          'idempotency-key': idemKey('again'),
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await call(buyer, 'POST', `/proposals/${bb.id}/accept`, undefined, {
          'idempotency-key': idemKey('b'),
        })
      ).statusCode,
    ).toBe(422); // auto-declined

    const after = json<BriefView>(await call(buyer, 'GET', `/briefs/${b.id}`));
    expect(after.status).toBe('closed');
    expect(after.proposals?.map((p) => p.status).sort()).toEqual(['accepted', 'declined']);

    const p = json<ProjectView>(await call(buyer, 'GET', `/projects/${created.projectId}`));
    expect(p.milestones.map((m) => m.amount)).toEqual([100_000, 150_000, 100_000]);
    expect(p.totalAmount).toBe(350_000);
    expect(p.seller.name).toBe('SellerA');
    expect(p.service).toBeNull();
    expect((await call(sellerA, 'GET', `/projects/${created.projectId}`)).statusCode).toBe(200);
    expect((await call(sellerB, 'GET', `/projects/${created.projectId}`)).statusCode).toBe(404);

    // normal funding flow works on a proposal-born project
    const fund = json<{ paymentId: string }>(
      await call(buyer, 'POST', `/milestones/${created.firstMilestoneId}/fund`, undefined, {
        'idempotency-key': idemKey('f'),
      }),
    );
    expect(
      (await call(buyer, 'POST', `/payments/${fund.paymentId}/simulate`, { outcome: 'succeeded' }))
        .statusCode,
    ).toBe(201);
    expect((await call(sellerA, 'POST', `/projects/${created.projectId}/accept`)).statusCode).toBe(201);
    const active = json<ProjectView>(await call(buyer, 'GET', `/projects/${created.projectId}`));
    expect(active.status).toBe('active');
    expect(active.escrow.held).toBe(100_000);
  });
});
