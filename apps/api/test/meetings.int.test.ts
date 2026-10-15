import { createHmac } from 'node:crypto';
import type { CodeEventView, CodeLinkView, MeetingView } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SECRET = vi.hoisted(() => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
  return 'test-webhook-secret-0123456789';
});

import { bootMarket, createTestApp, ORIGIN, type TestUser } from './helpers';

describe('Phase 7: meetings, calendar invites and GitHub code activity', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;
  let call: typeof m.call;
  let json: typeof m.json;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;
  let projectId: string;

  const soon = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
  const schedule = (u: TestUser, body: Record<string, unknown> = {}) =>
    call(u, 'POST', `/projects/${projectId}/meetings`, {
      title: 'Kickoff call',
      startsAt: soon(5),
      durationMin: 30,
      ...body,
    });

  beforeAll(async () => {
    app = await createTestApp();
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other } = m);
    projectId = (await m.activeProject()).projectId;
  });
  afterAll(async () => {
    await app?.close();
  });

  describe('meetings', () => {
    it('either participant schedules; outsiders cannot see or create; the other side is notified', async () => {
      expect((await call(null, 'POST', `/projects/${projectId}/meetings`, {})).statusCode).toBe(401);
      expect((await schedule(other)).statusCode).toBe(404);
      expect((await schedule(buyer, { title: 'x' })).statusCode).toBe(400);
      expect((await schedule(buyer, { startsAt: soon(-120) })).statusCode).toBe(422); // in the past
      expect((await schedule(buyer, { durationMin: 5 })).statusCode).toBe(400);

      const r = await schedule(buyer, { agenda: 'Review the milestones' });
      expect(r.statusCode).toBe(201);
      const v = json<MeetingView>(r);
      expect(v).toMatchObject({
        title: 'Kickoff call',
        status: 'scheduled',
        provider: 'stub',
        joinable: true,
      });
      expect(v.participants.map((p) => p.name)).toEqual(expect.arrayContaining(['Seller', 'Buyer']));
      expect((await call(other, 'GET', `/meetings/${v.id}`)).statusCode).toBe(404);
      expect((await call(other, 'GET', `/projects/${projectId}/meetings`)).statusCode).toBe(404);
      const mine = json<MeetingView[]>(await call(seller, 'GET', `/projects/${projectId}/meetings`));
      expect(mine.some((x) => x.id === v.id)).toBe(true);
      const note = json<{ items: { type: string }[] }>(await call(seller, 'GET', '/me/notifications'));
      expect(note.items.some((n) => n.type === 'meeting.scheduled')).toBe(true);
    });

    it('joining is only possible inside the window; the stub returns the in-app call page', async () => {
      const later = json<MeetingView>(
        await schedule(seller, { startsAt: soon(60 * 48), title: 'Next week sync' }),
      );
      expect(later.joinable).toBe(false);
      expect((await call(buyer, 'POST', `/meetings/${later.id}/join`)).statusCode).toBe(422);
      const now = json<MeetingView>(await schedule(seller, { title: 'Now-ish' }));
      const j = json<{ url: string; provider: string; recording: boolean }>(
        await call(buyer, 'POST', `/meetings/${now.id}/join`),
      );
      expect(j.provider).toBe('stub');
      expect(j.url).toMatch(new RegExp(`/meetings/${now.id}/call$`));
      expect(j.recording).toBe(false);
      expect(json<MeetingView>(await call(buyer, 'GET', `/meetings/${now.id}`)).status).toBe('started');
      expect((await call(other, 'POST', `/meetings/${now.id}/join`)).statusCode).toBe(404);
    });

    it('recording needs EVERY participant to consent, each for themselves, and can be withdrawn', async () => {
      const v = json<MeetingView>(await schedule(seller, { recording: true, title: 'Recorded demo' }));
      expect(v.recording).toEqual({ requested: true, allConsented: false });
      // the organizer's request counts as their consent; the buyer has not answered
      expect(v.participants.find((p) => p.name === 'Seller')!.consent).toBe(true);
      expect(v.participants.find((p) => p.name === 'Buyer')!.consent).toBeNull();
      expect(
        json<{ recording: boolean }>(await call(seller, 'POST', `/meetings/${v.id}/join`)).recording,
      ).toBe(false);

      // not requested → no consent endpoint
      const plain = json<MeetingView>(await schedule(seller, { title: 'Plain' }));
      expect((await call(buyer, 'PUT', `/meetings/${plain.id}/consent`, { consent: true })).statusCode).toBe(
        422,
      );
      expect((await call(other, 'PUT', `/meetings/${v.id}/consent`, { consent: true })).statusCode).toBe(404);
      expect((await call(buyer, 'PUT', `/meetings/${v.id}/consent`, { consent: 'yes' })).statusCode).toBe(
        400,
      );
    });

    it('recording turns on only after both consent, off again on withdrawal (before the meeting starts)', async () => {
      const v = json<MeetingView>(await schedule(buyer, { recording: true, title: 'Consent flow' }));
      const agreed = json<MeetingView>(
        await call(seller, 'PUT', `/meetings/${v.id}/consent`, { consent: true }),
      );
      expect(agreed.recording.allConsented).toBe(true);
      const declined = json<MeetingView>(
        await call(seller, 'PUT', `/meetings/${v.id}/consent`, { consent: false }),
      );
      expect(declined.recording.allConsented).toBe(false);
      await call(seller, 'PUT', `/meetings/${v.id}/consent`, { consent: true });
      expect(
        json<{ recording: boolean }>(await call(buyer, 'POST', `/meetings/${v.id}/join`)).recording,
      ).toBe(true);
      // after the meeting started, consent can no longer be changed
      expect((await call(seller, 'PUT', `/meetings/${v.id}/consent`, { consent: false })).statusCode).toBe(
        409,
      );
    });

    it('only the organizer cancels; cancelled meetings cannot be joined and the invite says CANCEL', async () => {
      const v = json<MeetingView>(await schedule(buyer, { title: 'To cancel' }));
      expect((await call(seller, 'POST', `/meetings/${v.id}/cancel`)).statusCode).toBe(422);
      const c = json<MeetingView>(await call(buyer, 'POST', `/meetings/${v.id}/cancel`));
      expect(c.status).toBe('cancelled');
      expect((await call(seller, 'POST', `/meetings/${v.id}/join`)).statusCode).toBe(422);
      expect((await call(buyer, 'POST', `/meetings/${v.id}/cancel`)).statusCode).toBe(409);
      const ics = (await call(seller, 'GET', `/meetings/${v.id}/ics`)).body.replace(/\r\n /g, '');
      expect(ics).toContain('METHOD:CANCEL');
      expect(ics).toContain('STATUS:CANCELLED');
      const note = json<{ items: { type: string }[] }>(await call(seller, 'GET', '/me/notifications'));
      expect(note.items.some((n) => n.type === 'meeting.cancelled')).toBe(true);
    });

    it('serves a calendar file to participants only', async () => {
      const v = json<MeetingView>(
        await schedule(seller, { title: 'Design, review; v2', agenda: 'Line one\nLine two' }),
      );
      const r = await call(buyer, 'GET', `/meetings/${v.id}/ics`);
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toMatch(/^text\/calendar/);
      expect(r.headers['content-disposition']).toMatch(/attachment/);
      const ics = r.body.replace(/\r\n /g, '');
      expect(ics).toContain(`UID:${v.id}@glasswork`);
      expect(ics).toContain('SUMMARY:Design\\, review\\; v2');
      expect(ics).toContain('ORGANIZER;CN=Seller:mailto:');
      expect(ics).toContain('ATTENDEE;CN=Buyer');
      expect(ics).toContain('METHOD:REQUEST');
      expect((await call(other, 'GET', `/meetings/${v.id}/ics`)).statusCode).toBe(404);
      expect((await call(null, 'GET', `/meetings/${v.id}/ics`)).statusCode).toBe(401);
    });

    it('keeps shared notes and lets participants end a meeting', async () => {
      const v = json<MeetingView>(await schedule(seller, { title: 'Notes meeting' }));
      const n = json<MeetingView>(
        await call(buyer, 'PUT', `/meetings/${v.id}/notes`, { notes: '- Send the logo files' }),
      );
      expect(n.notes).toBe('- Send the logo files');
      expect((await call(other, 'PUT', `/meetings/${v.id}/notes`, { notes: 'x' })).statusCode).toBe(404);
      expect(json<MeetingView>(await call(seller, 'POST', `/meetings/${v.id}/end`)).status).toBe('ended');
      expect((await call(seller, 'POST', `/meetings/${v.id}/end`)).statusCode).toBe(409);
    });
  });

  describe('GitHub code activity', () => {
    const REPO = 'acme-dev/shop-site';
    const hook = (
      event: string,
      payload: unknown,
      opts: { delivery?: string; secret?: string; signature?: string } = {},
    ) => {
      const body = JSON.stringify(payload);
      const sig =
        opts.signature ??
        `sha256=${createHmac('sha256', opts.secret ?? SECRET)
          .update(body)
          .digest('hex')}`;
      return app.inject({
        method: 'POST',
        url: '/v1/webhooks/github',
        headers: {
          ...ORIGIN,
          'content-type': 'application/json',
          'x-github-event': event,
          'x-github-delivery': opts.delivery ?? `d-${Date.now()}-${Math.random()}`,
          'x-hub-signature-256': sig,
        },
        payload: body,
      });
    };
    const push = (n: number) => ({
      ref: 'refs/heads/main',
      pusher: { name: 'sam' },
      repository: { full_name: REPO, html_url: `https://github.com/${REPO}` },
      commits: Array.from({ length: n }, (_, i) => ({
        message: `Change ${i + 1}`,
        timestamp: new Date().toISOString(),
      })),
      compare: `https://github.com/${REPO}/compare/a...b`,
    });

    it('only the seller connects repositories; formats are validated; duplicates are refused', async () => {
      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/code-links`, { repo: REPO })).statusCode,
      ).toBe(422);
      expect(
        (await call(other, 'POST', `/projects/${projectId}/code-links`, { repo: REPO })).statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/code-links`, { repo: 'not a repo' })).statusCode,
      ).toBe(400);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/code-links`, { repo: 'https://github.com/a/b' }))
          .statusCode,
      ).toBe(400);
      const ok = await call(seller, 'POST', `/projects/${projectId}/code-links`, { repo: REPO });
      expect(ok.statusCode).toBe(201);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/code-links`, { repo: REPO.toUpperCase() }))
          .statusCode,
      ).toBe(409);
      expect(
        json<CodeLinkView[]>(await call(buyer, 'GET', `/projects/${projectId}/code-links`)),
      ).toHaveLength(1);
    });

    it('rejects unsigned, wrongly signed and tampered webhooks', async () => {
      expect((await hook('push', push(1), { signature: 'sha256=00' })).statusCode).toBe(401);
      expect((await hook('push', push(1), { secret: 'a-different-secret-entirely' })).statusCode).toBe(401);
      const res = await app.inject({
        method: 'POST',
        url: '/v1/webhooks/github',
        headers: {
          ...ORIGIN,
          'content-type': 'application/json',
          'x-github-event': 'push',
          'x-github-delivery': 'x',
        },
        payload: JSON.stringify(push(1)),
      });
      expect(res.statusCode).toBe(401);
    });

    it('stores plain-language events for linked repos, idempotently, and shows them to both sides', async () => {
      const before = json<{ items: CodeEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/code-activity`),
      ).items.length;
      const r1 = await hook('push', push(3), { delivery: 'delivery-push-1' });
      expect(r1.statusCode).toBe(200);
      expect(r1.json()).toEqual({ stored: 1 });
      expect((await hook('push', push(3), { delivery: 'delivery-push-1' })).json()).toEqual({ stored: 0 }); // redelivery
      await hook('pull_request', {
        action: 'closed',
        repository: { full_name: REPO },
        pull_request: {
          title: 'Checkout flow',
          merged: true,
          changed_files: 4,
          merged_at: new Date().toISOString(),
          user: { login: 'sam' },
          html_url: `https://github.com/${REPO}/pull/7`,
        },
      });
      await hook('deployment_status', {
        repository: { full_name: REPO },
        deployment: { environment: 'production' },
        deployment_status: {
          state: 'success',
          environment_url: 'https://shop.example.com',
          created_at: new Date().toISOString(),
        },
      });
      const items = json<{ items: CodeEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/code-activity`),
      ).items;
      expect(items.length).toBe(before + 3);
      expect(items.map((i) => i.title)).toEqual(
        expect.arrayContaining([
          'sam saved 3 changes to main',
          'Merged into the main code: Checkout flow',
          'Deployed to the live site',
        ]),
      );
      expect(items.find((i) => i.kind === 'deployment')!.url).toBe('https://shop.example.com');
      expect(
        json<{ items: CodeEventView[] }>(await call(seller, 'GET', `/projects/${projectId}/code-activity`))
          .items.length,
      ).toBe(before + 3);
      expect((await call(other, 'GET', `/projects/${projectId}/code-activity`)).statusCode).toBe(404);
    });

    it('ignores unlinked repositories, pings and noise', async () => {
      const stray = { ...push(1), repository: { full_name: 'someone/else' } };
      expect((await hook('push', stray)).json()).toEqual({ stored: 0 });
      expect((await hook('ping', { zen: 'hi', repository: { full_name: REPO } })).json()).toEqual({
        stored: 0,
      });
      expect(
        (
          await hook('deployment_status', {
            repository: { full_name: REPO },
            deployment: { environment: 'production' },
            deployment_status: { state: 'in_progress' },
          })
        ).json(),
      ).toEqual({ stored: 0 });
    });

    it('only links an https URL from the payload, never javascript: or other schemes', async () => {
      await hook('deployment_status', {
        repository: { full_name: REPO },
        deployment: { environment: 'staging' },
        deployment_status: { state: 'success', environment_url: 'javascript:alert(1)' },
      });
      const items = json<{ items: CodeEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/code-activity`),
      ).items;
      expect(items.every((i) => i.url === null || i.url.startsWith('https://'))).toBe(true);
    });

    it('the seller can disconnect; further events are ignored', async () => {
      const link = json<CodeLinkView[]>(await call(seller, 'GET', `/projects/${projectId}/code-links`))[0]!;
      expect((await call(buyer, 'DELETE', `/projects/${projectId}/code-links/${link.id}`)).statusCode).toBe(
        422,
      );
      expect((await call(seller, 'DELETE', `/projects/${projectId}/code-links/${link.id}`)).statusCode).toBe(
        200,
      );
      expect((await hook('push', push(1))).json()).toEqual({ stored: 0 });
    });
  });
});
