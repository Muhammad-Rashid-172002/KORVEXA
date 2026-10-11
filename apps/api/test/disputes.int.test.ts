import { eq, milestones, payments, sql, type DbClient } from '@glasswork/db';
import type { ChangeRequestView, DisputeView, ProjectEventView, ProjectView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { bootMarket, createFile, createTestApp, makeAdmin, signUpVerified, type TestUser } from './helpers';

describe('Phase 5: change requests and disputes', () => {
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

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DbClient>(DB);
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other, ops } = m);
    growth = await signUpVerified(app, { name: 'Growth' });
    await makeAdmin(app, growth, ['growth']);
    const product = await signUpVerified(app, { name: 'Product' });
    await makeAdmin(app, product, ['product']);
    // real-looking fees so commission/fee arithmetic is meaningful: 5% buyer fee, 10% seller commission
    expect(
      (
        await call(product, 'PUT', '/admin/settings/fees', {
          buyerServiceBps: 500,
          buyerServiceMin: 0,
          sellerCommissionBps: 1000,
          sellerCommissionMin: 0,
          autoApproveDays: 5,
        })
      ).statusCode,
    ).toBe(200);
  });
  afterAll(async () => {
    await app?.close();
  });

  const view = async (u: TestUser, id: string) => json<ProjectView>(await call(u, 'GET', `/projects/${id}`));
  const trial = async () =>
    json<{ trialBalance: number; cash: number; revenue: number; escrow: number; sellerPayable: number }>(
      await call(ops, 'GET', '/admin/ledger/summary'),
    );
  const REASON = 'The delivered work does not match the agreed acceptance criteria at all.';

  describe('change requests', () => {
    const body = {
      title: 'Add an admin dashboard',
      description: 'We also need a small admin dashboard for staff.',
      daysDelta: 5,
      milestones: [{ title: 'Admin dashboard', amount: 20_000, days: 6 }],
    };

    it('either party proposes; only the other party answers; acceptance adds an unfunded milestone and shifts dates', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const before = await view(buyer, projectId);
      expect((await call(other, 'POST', `/projects/${projectId}/change-requests`, body)).statusCode).toBe(
        404,
      );
      expect((await call(null, 'POST', `/projects/${projectId}/change-requests`, body)).statusCode).toBe(401);
      expect(
        (
          await call(buyer, 'POST', `/projects/${projectId}/change-requests`, {
            ...body,
            milestones: [],
            daysDelta: 0,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call(buyer, 'POST', `/projects/${projectId}/change-requests`, {
            ...body,
            milestones: [{ title: 'x', amount: 1, days: 1 }],
          })
        ).statusCode,
      ).toBe(400);

      const proposed = json<ChangeRequestView[]>(
        await call(buyer, 'POST', `/projects/${projectId}/change-requests`, body),
      );
      const cr = proposed[0]!;
      expect(cr).toMatchObject({
        status: 'proposed',
        priceDeltaAmount: 20_000,
        daysDelta: 5,
        canRespond: false,
        canWithdraw: true,
      });
      expect((await call(buyer, 'POST', `/projects/${projectId}/change-requests`, body)).statusCode).toBe(
        422,
      ); // one open at a time
      expect(
        json<ChangeRequestView[]>(await call(seller, 'GET', `/projects/${projectId}/change-requests`))[0],
      ).toMatchObject({ canRespond: true, canWithdraw: false });

      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/change-requests/${cr.id}/accept`)).statusCode,
      ).toBe(422); // not the other party
      expect(
        (await call(other, 'POST', `/projects/${projectId}/change-requests/${cr.id}/accept`)).statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/change-requests/${cr.id}/withdraw`)).statusCode,
      ).toBe(422);

      expect(
        json<ChangeRequestView[]>(
          await call(seller, 'POST', `/projects/${projectId}/change-requests/${cr.id}/accept`),
        )[0]!.status,
      ).toBe('accepted');
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/change-requests/${cr.id}/accept`)).statusCode,
      ).toBe(422);

      const after = await view(buyer, projectId);
      expect(after.totalAmount).toBe(before.totalAmount + 20_000);
      expect(after.milestones).toHaveLength(4);
      const added = after.milestones[3]!;
      expect(added).toMatchObject({
        position: 4,
        title: 'Admin dashboard',
        amount: 20_000,
        status: 'pending',
      });
      expect(added.actions).toEqual(['fund']); // the buyer must fund it like any milestone
      expect(after.milestones[0]!.plannedDue! > before.milestones[0]!.plannedDue!).toBe(true); // shifted by 5 days
      expect(milestoneIds).toHaveLength(3);

      await m.fund(buyer, added.id);
      expect((await view(buyer, projectId)).milestones[3]!.status).toBe('funded');
      const feed = json<{ items: ProjectEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?filter=milestones&limit=100`),
      );
      expect(feed.items.map((e) => e.type)).toEqual(
        expect.arrayContaining(['change.proposed', 'change.accepted']),
      );
    });

    it('decline and withdraw are role-scoped and final; changes need an active project', async () => {
      const { projectId } = await m.activeProject();
      const a = json<ChangeRequestView[]>(
        await call(seller, 'POST', `/projects/${projectId}/change-requests`, {
          ...body,
          title: 'Seller proposes more work',
        }),
      )[0]!;
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/change-requests/${a.id}/decline`)).statusCode,
      ).toBe(422);
      expect(
        json<ChangeRequestView[]>(
          await call(buyer, 'POST', `/projects/${projectId}/change-requests/${a.id}/decline`),
        )[0]!.status,
      ).toBe('declined');
      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/change-requests/${a.id}/decline`)).statusCode,
      ).toBe(422);

      const b = json<ChangeRequestView[]>(
        await call(buyer, 'POST', `/projects/${projectId}/change-requests`, {
          ...body,
          title: 'Buyer proposes more work',
        }),
      )[0]!;
      expect(
        json<ChangeRequestView[]>(
          await call(buyer, 'POST', `/projects/${projectId}/change-requests/${b.id}/withdraw`),
        )[0]!.status,
      ).toBe('withdrawn');
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/change-requests/${b.id}/accept`)).statusCode,
      ).toBe(422);

      await db.db.execute(sql`update projects set status = 'paused' where id = ${projectId}`);
      expect((await call(buyer, 'POST', `/projects/${projectId}/change-requests`, body)).statusCode).toBe(
        422,
      );
      await db.db.execute(sql`update projects set status = 'active' where id = ${projectId}`);
    });
  });

  describe('disputes', () => {
    it('opening freezes the milestone and project, snapshots a case file, and stops the auto-approve timer', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const m1 = milestoneIds[0]!;
      await call(seller, 'POST', `/milestones/${m1}/submit`, { note: 'done' });
      await call(buyer, 'GET', `/projects/${projectId}/chat`); // creates the project chat
      expect((await call(other, 'POST', `/milestones/${m1}/dispute`, { reason: REASON })).statusCode).toBe(
        404,
      );
      expect((await call(null, 'POST', `/milestones/${m1}/dispute`, { reason: REASON })).statusCode).toBe(
        401,
      );
      expect(
        (await call(buyer, 'POST', `/milestones/${m1}/dispute`, { reason: 'too short' })).statusCode,
      ).toBe(400);
      expect(
        (await call(buyer, 'POST', `/milestones/${milestoneIds[1]}/dispute`, { reason: REASON })).statusCode,
      ).toBe(422); // unfunded

      const d = json<DisputeView>(await call(buyer, 'POST', `/milestones/${m1}/dispute`, { reason: REASON }));
      expect(d).toMatchObject({
        status: 'open',
        milestoneTitle: 'Kickoff & plan',
        openedBy: { name: 'Buyer' },
      });
      const cf = d.caseFile as {
        milestone: { status: string; submissionNote: string };
        timeline: { type: string }[];
        project: { code: string };
      };
      expect(cf.milestone).toMatchObject({ status: 'submitted', submissionNote: 'done' });
      expect(cf.timeline.map((t) => t.type)).toEqual(
        expect.arrayContaining(['milestone.funded', 'milestone.submitted']),
      );

      const p = await view(buyer, projectId);
      expect(p.status).toBe('disputed');
      expect(p.milestones[0]!.status).toBe('disputed');
      expect(p.health).toBe('blocked');
      expect(p.escrow.held).toBe(30_000); // funds stay held, nothing moves yet
      expect((await call(seller, 'POST', `/milestones/${m1}/dispute`, { reason: REASON })).statusCode).toBe(
        422,
      );
      expect((await call(buyer, 'POST', `/milestones/${m1}/approve`)).statusCode).toBe(422);

      // the timer cannot approve a disputed milestone
      await db.db
        .update(milestones)
        .set({ autoApproveAt: new Date(Date.now() - 1000) })
        .where(eq(milestones.id, m1));
      const auto = await call(null, 'POST', `/internal/milestones/${m1}/auto-approve`, undefined, {
        'x-internal-token': 'dev-only-internal-token-change-me-0123456789',
      });
      expect(json<{ result: string }>(auto).result).toBe('skipped');
      expect((await view(buyer, projectId)).milestones[0]!.status).toBe('disputed');
    });

    it('both parties add evidence (notes, scanned files) and see each other’s; outsiders see nothing', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const d = json<DisputeView>(
        await call(buyer, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      const file = await createFile(app, buyer, 'evidence', {
        name: 'screenshot.png',
        mimeType: 'image/png',
      });
      const pending = await createFile(app, buyer, 'evidence', { status: 'uploaded' });
      const sellers = await createFile(app, seller, 'evidence');

      expect((await call(other, 'GET', `/disputes/${d.id}`)).statusCode).toBe(404);
      expect((await call(other, 'POST', `/disputes/${d.id}/evidence`, { note: 'hi' })).statusCode).toBe(404);
      expect((await call(buyer, 'POST', `/disputes/${d.id}/evidence`, {})).statusCode).toBe(400);
      expect(
        (await call(buyer, 'POST', `/disputes/${d.id}/evidence`, { kind: 'upload', fileId: sellers }))
          .statusCode,
      ).toBe(404); // not theirs
      expect(
        (await call(buyer, 'POST', `/disputes/${d.id}/evidence`, { kind: 'upload', fileId: pending }))
          .statusCode,
      ).toBe(422);
      expect(
        (await call(buyer, 'POST', `/disputes/${d.id}/evidence`, { kind: 'message', refId: d.id }))
          .statusCode,
      ).toBe(404);

      await call(seller, 'POST', `/disputes/${d.id}/evidence`, {
        note: 'I delivered everything listed in the plan.',
      });
      const withFile = json<DisputeView>(
        await call(buyer, 'POST', `/disputes/${d.id}/evidence`, {
          kind: 'upload',
          fileId: file,
          note: 'Screenshot of the bug',
        }),
      );
      expect(withFile.evidence.map((e) => e.by.name)).toEqual(['Seller', 'Buyer']);

      // evidence files are readable by BOTH parties (and not by outsiders)
      expect(json<{ url: string }>(await call(seller, 'GET', `/files/${file}/download`)).url).toContain(file);
      expect((await call(other, 'GET', `/files/${file}/download`)).statusCode).toBe(404);
      expect(json<DisputeView[]>(await call(seller, 'GET', `/projects/${projectId}/disputes`))).toHaveLength(
        1,
      );
    });

    it('admin queue and scopes: only operations/product resolve; the case file is complete', async () => {
      const { milestoneIds } = await m.activeProject();
      const d = json<DisputeView>(
        await call(seller, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      expect((await call(buyer, 'GET', '/admin/disputes')).statusCode).toBe(403);
      const queue = json<{ id: string }[]>(await call(growth, 'GET', '/admin/disputes'));
      expect(queue.some((q) => q.id === d.id)).toBe(true);
      const full = json<DisputeView>(await call(growth, 'GET', `/admin/disputes/${d.id}`));
      expect(Object.keys(full.caseFile)).toEqual(
        expect.arrayContaining([
          'project',
          'milestone',
          'deliverables',
          'messages',
          'timeline',
          'changeRequests',
        ]),
      );
      const body = { outcome: 'release', note: 'Seller delivered as agreed.' };
      expect((await call(growth, 'POST', `/admin/disputes/${d.id}/resolve`, body)).statusCode).toBe(403);
      expect((await call(buyer, 'POST', `/admin/disputes/${d.id}/resolve`, body)).statusCode).toBe(403);
      expect(
        (await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, { outcome: 'release', note: 'short' }))
          .statusCode,
      ).toBe(400);
      expect(json<DisputeView>(await call(ops, 'POST', `/admin/disputes/${d.id}/review`)).status).toBe(
        'under_review',
      );
      expect((await call(ops, 'POST', `/admin/disputes/${d.id}/review`)).statusCode).toBe(422);
    });

    it('RELEASE pays the seller (commission applied), reopens the project, and the books balance', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const d = json<DisputeView>(
        await call(buyer, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      const before = await trial();
      const res = await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
        outcome: 'release',
        note: 'Seller delivered as agreed.',
      });
      expect(res.statusCode, res.body).toBe(201);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(after.sellerPayable - before.sellerPayable).toBe(27_000); // 30,000 − 10%
      expect(after.escrow - before.escrow).toBe(-30_000);

      const p = await view(buyer, projectId);
      expect(p.milestones[0]!.status).toBe('released');
      expect(p.status).toBe('active'); // work remains
      const closed = json<DisputeView>(await call(buyer, 'GET', `/disputes/${d.id}`));
      expect(closed).toMatchObject({
        status: 'resolved',
        outcome: 'release',
        resolutionNote: 'Seller delivered as agreed.',
      });
      expect(
        (
          await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
            outcome: 'refund',
            note: 'Changing my mind later.',
          })
        ).statusCode,
      ).toBe(422);
      expect((await call(buyer, 'POST', `/disputes/${d.id}/evidence`, { note: 'late' })).statusCode).toBe(
        422,
      );
    });

    it('REFUND returns the milestone AND the buyer fee in full; the payment is marked refunded', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const d = json<DisputeView>(
        await call(seller, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      const before = await trial();
      expect(
        (
          await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
            outcome: 'refund',
            refundAmount: 5,
            note: 'Buyer is right on the facts.',
          })
        ).statusCode,
      ).toBe(422);
      expect(
        (
          await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
            outcome: 'refund',
            note: 'Buyer is right on the facts.',
          })
        ).statusCode,
      ).toBe(201);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(before.cash - after.cash).toBe(31_500); // 30,000 + 5% fee
      expect(before.revenue - after.revenue).toBe(1_500);
      expect(after.sellerPayable).toBe(before.sellerPayable); // seller gets nothing
      expect((await view(buyer, projectId)).milestones[0]!.status).toBe('refunded');
      const pay = await db.db.select().from(payments).where(eq(payments.milestoneId, milestoneIds[0]!));
      expect(pay[0]!.status).toBe('refunded');
    });

    it('SPLIT refunds part to the buyer; the seller gets the rest minus a pro-rated commission; fee kept', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const d = json<DisputeView>(
        await call(buyer, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      const bad = (refundAmount: number | undefined) =>
        call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
          outcome: 'split',
          refundAmount,
          note: 'Meeting in the middle.',
        });
      expect((await bad(undefined)).statusCode).toBe(422);
      expect((await bad(30_000)).statusCode).toBe(422); // must leave something for the seller
      const before = await trial();
      expect((await bad(10_000)).statusCode).toBe(201);
      const after = await trial();
      expect(after.trialBalance).toBe(0);
      expect(before.cash - after.cash).toBe(10_000); // only the refund leaves cash
      expect(after.sellerPayable - before.sellerPayable).toBe(18_000); // 20,000 − 2,000 pro-rated commission
      expect(after.revenue - before.revenue).toBe(2_000);
      expect(after.escrow - before.escrow).toBe(-30_000);
      const pay = await db.db.select().from(payments).where(eq(payments.milestoneId, milestoneIds[0]!));
      expect(pay[0]!.status).toBe('partially_refunded');
      expect(json<DisputeView>(await call(seller, 'GET', `/disputes/${d.id}`))).toMatchObject({
        outcome: 'split',
        refundAmount: 10_000,
      });
      expect((await view(buyer, projectId)).milestones[0]!.status).toBe('released');
    });

    it('resolving the last open milestone completes the project, which the buyer can then review', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const [m1, m2, m3] = milestoneIds as [string, string, string];
      await call(seller, 'POST', `/milestones/${m1}/submit`, {});
      await call(buyer, 'POST', `/milestones/${m1}/approve`);
      for (const id of [m2]) {
        await m.fund(buyer, id);
        await call(seller, 'POST', `/milestones/${id}/start`);
        await call(seller, 'POST', `/milestones/${id}/submit`, {});
        await call(buyer, 'POST', `/milestones/${id}/approve`);
      }
      await m.fund(buyer, m3);
      await call(seller, 'POST', `/milestones/${m3}/start`);
      const d = json<DisputeView>(
        await call(seller, 'POST', `/milestones/${m3}/dispute`, { reason: REASON }),
      );
      expect(
        (
          await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
            outcome: 'release',
            note: 'Delivery was complete.',
          })
        ).statusCode,
      ).toBe(201);
      const p = await view(buyer, projectId);
      expect(p.status).toBe('completed');
      expect(p.completedAt).not.toBeNull();
      expect((await trial()).trialBalance).toBe(0);
      const review = await call(buyer, 'POST', `/projects/${projectId}/review`, {
        ratingOverall: 4,
        ratingCommunication: 4,
        ratingQuality: 4,
        ratingTimeliness: 4,
        body: 'Dispute resolved fairly.',
      });
      expect(review.statusCode).toBe(201);
    });

    it('a fully refunded project with nothing paid is cancelled after resolution', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      // make the other milestones terminal so the refunded one is the only thing left
      await db.db.execute(
        sql`update milestones set status = 'cancelled' where project_id = ${projectId} and id <> ${milestoneIds[0]!}`,
      );
      const d = json<DisputeView>(
        await call(buyer, 'POST', `/milestones/${milestoneIds[0]}/dispute`, { reason: REASON }),
      );
      expect(
        (
          await call(ops, 'POST', `/admin/disputes/${d.id}/resolve`, {
            outcome: 'refund',
            note: 'Nothing was delivered.',
          })
        ).statusCode,
      ).toBe(201);
      expect((await view(buyer, projectId)).status).toBe('cancelled');
    });
  });
});
