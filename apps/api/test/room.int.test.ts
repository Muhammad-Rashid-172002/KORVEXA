import { eq, files, milestones, sql, type DbClient } from '@glasswork/db';
import type {
  DeliverableView,
  ProjectEventView,
  ProjectView,
  PreviewView,
  TaskView,
} from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { bootMarket, createFile, createTestApp, findEmailJob, type TestUser } from './helpers';

type Board = { columns: Record<'todo' | 'in_progress' | 'in_review' | 'done', TaskView[]> };

describe('Phase 4: Live Project Room API', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;
  let db: DbClient;
  let call: typeof m.call;
  let json: typeof m.json;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<DbClient>(DB);
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other } = m);
  });
  afterAll(async () => {
    await app?.close();
  });

  const taskIdOf = (r: { json: () => unknown }) => (r.json() as { taskId: string }).taskId;
  const view = async (u: TestUser, id: string) => json<ProjectView>(await call(u, 'GET', `/projects/${id}`));
  const board = async (u: TestUser, id: string) => json<Board>(await call(u, 'GET', `/projects/${id}/board`));

  describe('board', () => {
    it('buyer and seller see the board; outsiders get 404; only the seller manages tasks', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const body = { title: 'Set up CI pipeline', milestoneId: milestoneIds[0] };
      expect((await call(null, 'GET', `/projects/${projectId}/board`)).statusCode).toBe(401);
      expect((await call(other, 'GET', `/projects/${projectId}/board`)).statusCode).toBe(404);
      expect((await call(other, 'POST', `/projects/${projectId}/tasks`, body)).statusCode).toBe(404);
      expect((await call(buyer, 'POST', `/projects/${projectId}/tasks`, body)).statusCode).toBe(422);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/tasks`, { ...body, milestoneId: uuidv7() }))
          .statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/tasks`, { ...body, assigneeId: other.userId }))
          .statusCode,
      ).toBe(422);
      expect((await call(seller, 'POST', `/projects/${projectId}/tasks`, { title: 'x' })).statusCode).toBe(
        400,
      );
      expect((await call(seller, 'POST', `/projects/${projectId}/tasks`, body)).statusCode).toBe(201);
      expect((await board(buyer, projectId)).columns.todo.map((t) => t.title)).toEqual([
        'Set up CI pipeline',
      ]);
    });

    it('tasks cannot be touched through another project’s url', async () => {
      const a = await m.activeProject();
      const b = await m.activeProject();
      const id = taskIdOf(
        await call(seller, 'POST', `/projects/${a.projectId}/tasks`, { title: 'Task in project A' }),
      );
      expect(
        (await call(seller, 'PATCH', `/projects/${b.projectId}/tasks/${id}`, { status: 'done' })).statusCode,
      ).toBe(404);
      expect((await call(seller, 'DELETE', `/projects/${b.projectId}/tasks/${id}`)).statusCode).toBe(404);
      expect((await call(buyer, 'GET', `/projects/${b.projectId}/tasks/${id}/comments`)).statusCode).toBe(
        404,
      );
    });

    it('moves tasks between columns keeping a stable order, records events, and feeds weighted progress', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const mk = async (title: string) =>
        taskIdOf(
          await call(seller, 'POST', `/projects/${projectId}/tasks`, { title, milestoneId: milestoneIds[0] }),
        );
      const [t1, t2, t3, t4] = [
        await mk('Task one'),
        await mk('Task two'),
        await mk('Task three'),
        await mk('Task four'),
      ];

      let b = json<Board>(
        await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t3}`, { status: 'in_progress' }),
      );
      expect(b.columns.in_progress.map((t) => t.id)).toEqual([t3]);
      b = json<Board>(
        await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t1}`, {
          status: 'in_progress',
          position: 0,
        }),
      );
      expect(b.columns.in_progress.map((t) => t.id)).toEqual([t1, t3]);
      b = json<Board>(await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t2}`, { status: 'done' }));
      expect(b.columns.todo.map((t) => t.id)).toEqual([t4]);
      expect(b.columns.done.map((t) => t.id)).toEqual([t2]);

      // first milestone (30% of $1,000) is in progress with 1 of 4 tasks done → 0.25 * 0.6 * 30% = 4.5%
      const v = await view(buyer, projectId);
      expect(v.milestones[0]!.tasks).toEqual({ done: 1, total: 4 });
      expect(v.progress).toBe(4.5);
      await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t1}`, { status: 'done' });
      await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t3}`, { status: 'done' });
      await call(seller, 'PATCH', `/projects/${projectId}/tasks/${t4}`, { status: 'done' });
      expect((await view(buyer, projectId)).progress).toBe(18); // 30% * 0.6
      expect((await call(seller, 'DELETE', `/projects/${projectId}/tasks/${t4}`)).statusCode).toBe(200);
      expect((await view(buyer, projectId)).milestones[0]!.tasks).toEqual({ done: 3, total: 3 });

      const feed = json<{ items: ProjectEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?filter=tasks`),
      );
      expect(feed.items.map((e) => e.type)).toContain('task.moved');
      expect(feed.items.every((e) => e.type.startsWith('task.'))).toBe(true);
    });

    it('both parties comment; the other party is notified; outsiders cannot read or write comments', async () => {
      const { projectId } = await m.activeProject();
      const id = taskIdOf(
        await call(seller, 'POST', `/projects/${projectId}/tasks`, { title: 'Discuss the header design' }),
      );
      const c1 = await call(buyer, 'POST', `/projects/${projectId}/tasks/${id}/comments`, {
        body: 'Can we make it sticky?',
      });
      expect(c1.statusCode).toBe(201);
      await call(seller, 'POST', `/projects/${projectId}/tasks/${id}/comments`, {
        body: 'Yes, done tomorrow.',
      });
      const list = json<{ body: string; author: { name: string } }[]>(
        await call(buyer, 'GET', `/projects/${projectId}/tasks/${id}/comments`),
      );
      expect(list.map((c) => c.author.name)).toEqual(['Buyer', 'Seller']);
      expect(
        (await call(other, 'POST', `/projects/${projectId}/tasks/${id}/comments`, { body: 'hi' })).statusCode,
      ).toBe(404);
      expect((await call(other, 'GET', `/projects/${projectId}/tasks/${id}/comments`)).statusCode).toBe(404);
      expect(
        (await call(buyer, 'POST', `/projects/${projectId}/tasks/${id}/comments`, { body: '' })).statusCode,
      ).toBe(400);
      const n = json<{ items: { type: string }[] }>(await call(seller, 'GET', '/me/notifications'));
      expect(n.items.some((i) => i.type === 'task.comment')).toBe(true);
      expect((await board(seller, projectId)).columns.todo[0]!.commentCount).toBe(2);
    });
  });

  describe('overview: health, deadline, current milestone', () => {
    it('derives health from facts and exposes the next deadline', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const v = await view(buyer, projectId);
      expect(v.health).toBe('on_track');
      expect(v.currentMilestoneId).toBe(milestoneIds[0]);
      expect(v.nextDeadline?.milestoneId).toBe(milestoneIds[0]);

      await db.db
        .update(milestones)
        .set({ plannedDue: '2020-01-01' })
        .where(eq(milestones.id, milestoneIds[0]!));
      const late = await view(buyer, projectId);
      expect(late.health).toBe('at_risk');
      expect(late.healthReason).toContain('Milestone 1');

      await db.db.execute(sql`update milestones set status = 'released' where id = ${milestoneIds[0]!}`);
      const blocked = await view(seller, projectId);
      expect(blocked.health).toBe('blocked');
      expect(blocked.healthReason).toBe('Waiting for the buyer to fund milestone 2');
      expect(blocked.currentMilestoneId).toBe(milestoneIds[1]);
    });
  });

  describe('deliverables', () => {
    it('versioned uploads: seller only, own clean deliverable files only, older versions superseded', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const mid = milestoneIds[0]!;
      const f1 = await createFile(app, seller, 'deliverable', {
        name: 'build-v1.zip',
        mimeType: 'application/zip',
      });
      const f2 = await createFile(app, seller, 'deliverable', {
        name: 'build-v2.zip',
        mimeType: 'application/zip',
      });
      const buyerFile = await createFile(app, buyer, 'deliverable');
      const pending = await createFile(app, seller, 'deliverable', { status: 'uploaded' });
      const wrongPurpose = await createFile(app, seller, 'portfolio');

      expect((await call(buyer, 'POST', `/milestones/${mid}/deliverables`, { fileId: f1 })).statusCode).toBe(
        422,
      );
      expect((await call(other, 'POST', `/milestones/${mid}/deliverables`, { fileId: f1 })).statusCode).toBe(
        404,
      );
      expect(
        (await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: buyerFile })).statusCode,
      ).toBe(404);
      expect(
        (await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: pending })).statusCode,
      ).toBe(422);
      expect(
        (await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: wrongPurpose })).statusCode,
      ).toBe(422);

      const v1 = await call(seller, 'POST', `/milestones/${mid}/deliverables`, {
        fileId: f1,
        note: 'First drop',
      });
      expect(v1.statusCode).toBe(201);
      expect(json<DeliverableView>(v1)).toMatchObject({
        version: 1,
        status: 'submitted',
        note: 'First drop',
      });
      const v2 = json<DeliverableView>(
        await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: f2 }),
      );
      expect(v2.version).toBe(2);
      const all = json<DeliverableView[]>(await call(buyer, 'GET', `/projects/${projectId}/deliverables`));
      expect(all.map((d) => [d.version, d.status])).toEqual([
        [2, 'submitted'],
        [1, 'superseded'],
      ]);
      expect((await call(other, 'GET', `/projects/${projectId}/deliverables`)).statusCode).toBe(404);
    });

    it('feedback is pinned to a place; milestone decisions mirror onto the latest version', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const mid = milestoneIds[0]!;
      const f = await createFile(app, seller, 'deliverable', { name: 'design.pdf' });
      const d = json<DeliverableView>(
        await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: f }),
      );
      await call(seller, 'POST', `/milestones/${mid}/submit`, { note: 'Please review' });

      expect((await call(other, 'POST', `/deliverables/${d.id}/feedback`, { body: 'hi' })).statusCode).toBe(
        404,
      );
      expect((await call(buyer, 'POST', `/deliverables/${d.id}/feedback`, { body: '' })).statusCode).toBe(
        400,
      );
      expect(
        (
          await call(buyer, 'POST', `/deliverables/${d.id}/feedback`, {
            body: 'x',
            anchor: { kind: 'region', x: 5 },
          })
        ).statusCode,
      ).toBe(400);
      const withFb = json<DeliverableView>(
        await call(buyer, 'POST', `/deliverables/${d.id}/feedback`, {
          body: 'Logo is too small',
          anchor: { kind: 'region', page: 2, x: 0.1, y: 0.2, w: 0.3, h: 0.1 },
        }),
      );
      expect(withFb.feedback[0]).toMatchObject({
        body: 'Logo is too small',
        resolved: false,
        anchor: { kind: 'region', page: 2 },
      });

      await call(buyer, 'POST', `/milestones/${mid}/request-revision`, { note: 'Fix the logo please' });
      expect(
        json<DeliverableView[]>(await call(buyer, 'GET', `/projects/${projectId}/deliverables`))[0]!.status,
      ).toBe('revision_requested');

      const f2 = await createFile(app, seller, 'deliverable', { name: 'design-v2.pdf' });
      await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: f2 });
      await call(seller, 'POST', `/milestones/${mid}/submit`, {});
      const fbId = withFb.feedback[0]!.id;
      const resolved = json<DeliverableView>(
        await call(seller, 'PUT', `/deliverable-feedback/${fbId}/resolved`, { resolved: true }),
      );
      expect(resolved.feedback[0]!.resolved).toBe(true);
      expect(
        (await call(other, 'PUT', `/deliverable-feedback/${fbId}/resolved`, { resolved: false })).statusCode,
      ).toBe(404);

      await call(buyer, 'POST', `/milestones/${mid}/approve`);
      const final = json<DeliverableView[]>(await call(buyer, 'GET', `/projects/${projectId}/deliverables`));
      expect(final.map((x) => [x.version, x.status])).toEqual([
        [2, 'approved'],
        [1, 'superseded'],
      ]);
      // After approval nothing more can be uploaded to that milestone.
      expect(
        (
          await call(seller, 'POST', `/milestones/${mid}/deliverables`, {
            fileId: await createFile(app, seller, 'deliverable'),
          })
        ).statusCode,
      ).toBe(422);
    });

    it('downloads: participants get a presigned URL for CLEAN files only; everyone else gets 404 (also via /files)', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const mid = milestoneIds[0]!;
      const f = await createFile(app, seller, 'deliverable', {
        name: 'release.zip',
        mimeType: 'application/zip',
      });
      const d = json<DeliverableView>(
        await call(seller, 'POST', `/milestones/${mid}/deliverables`, { fileId: f }),
      );

      const ok = json<{ url: string }>(await call(buyer, 'GET', `/deliverables/${d.id}/download`));
      expect(ok.url).toContain(`u/${seller.userId}/${f}`);
      expect(ok.url).toContain('X-Amz-Expires=300');
      expect(json<{ url: string }>(await call(buyer, 'GET', `/files/${f}/download`)).url).toContain(f);
      expect((await call(null, 'GET', `/deliverables/${d.id}/download`)).statusCode).toBe(401);
      expect((await call(other, 'GET', `/deliverables/${d.id}/download`)).statusCode).toBe(404);
      expect((await call(other, 'GET', `/files/${f}/download`)).statusCode).toBe(404);
      // The owner-only endpoint is unchanged: the buyer cannot read it through the old route.
      expect((await call(buyer, 'GET', `/me/files/${f}`)).statusCode).toBe(404);

      // A file that is not (or no longer) clean is not downloadable by anyone, even participants.
      for (const status of ['uploaded', 'infected', 'rejected'] as const) {
        await db.db.update(files).set({ status }).where(eq(files.id, f));
        expect((await call(buyer, 'GET', `/deliverables/${d.id}/download`)).statusCode).toBe(404);
        expect((await call(seller, 'GET', `/files/${f}/download`)).statusCode).toBe(404);
      }
      expect(projectId).toBeTruthy();
    });
  });

  describe('previews', () => {
    it('https only; seller manages; participants read; last-updated moves on edit', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const good = {
        kind: 'staging',
        label: 'Staging site',
        url: 'https://staging.example.com',
        milestoneId: milestoneIds[0],
      };
      expect(
        (
          await call(seller, 'POST', `/projects/${projectId}/previews`, {
            ...good,
            url: 'http://insecure.example.com',
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call(seller, 'POST', `/projects/${projectId}/previews`, {
            ...good,
            url: 'javascript:alert(1)',
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/previews`, { ...good, kind: 'nope' })).statusCode,
      ).toBe(400);
      expect((await call(buyer, 'POST', `/projects/${projectId}/previews`, good)).statusCode).toBe(422);
      expect((await call(other, 'POST', `/projects/${projectId}/previews`, good)).statusCode).toBe(404);
      expect(
        (await call(seller, 'POST', `/projects/${projectId}/previews`, { ...good, milestoneId: uuidv7() }))
          .statusCode,
      ).toBe(404);

      const created = json<PreviewView[]>(
        await call(seller, 'POST', `/projects/${projectId}/previews`, good),
      );
      expect(created).toHaveLength(1);
      const id = created[0]!.id;
      await new Promise((r) => setTimeout(r, 15));
      const edited = json<PreviewView[]>(
        await call(seller, 'PUT', `/projects/${projectId}/previews/${id}`, {
          ...good,
          label: 'Staging (new build)',
        }),
      );
      expect(edited[0]!.label).toBe('Staging (new build)');
      expect(new Date(edited[0]!.lastUpdatedAt).getTime()).toBeGreaterThan(
        new Date(created[0]!.lastUpdatedAt).getTime(),
      );
      expect(json<PreviewView[]>(await call(buyer, 'GET', `/projects/${projectId}/previews`))).toHaveLength(
        1,
      );
      expect((await call(other, 'GET', `/projects/${projectId}/previews`)).statusCode).toBe(404);
      expect((await call(buyer, 'DELETE', `/projects/${projectId}/previews/${id}`)).statusCode).toBe(422);
      expect(
        json<PreviewView[]>(await call(seller, 'DELETE', `/projects/${projectId}/previews/${id}`)),
      ).toHaveLength(0);
    });
  });

  describe('activity feed', () => {
    it('lists every kind of event, filterable and paginated, participants only', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      await call(seller, 'POST', `/projects/${projectId}/tasks`, { title: 'Feed task one' });
      await call(seller, 'POST', `/projects/${projectId}/previews`, {
        kind: 'figma',
        label: 'Design file',
        url: 'https://figma.com/file/abc',
      });
      await call(seller, 'POST', `/milestones/${milestoneIds[0]}/submit`, {});
      expect((await call(other, 'GET', `/projects/${projectId}/events`)).statusCode).toBe(404);

      const all = json<{ items: ProjectEventView[]; nextCursor: string | null }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?limit=100`),
      );
      const types = all.items.map((e) => e.type);
      expect(types).toEqual(
        expect.arrayContaining([
          'project.ordered',
          'milestone.funded',
          'project.accepted',
          'milestone.started',
          'task.created',
          'preview.added',
          'milestone.submitted',
        ]),
      );
      expect(all.items[0]!.actor?.name).toBeTruthy();

      const money = json<{ items: ProjectEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?filter=money`),
      );
      expect(money.items.map((e) => e.type).sort()).toEqual(['milestone.funded', 'payment.started']);
      const files = json<{ items: ProjectEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?filter=files`),
      );
      expect(files.items.map((e) => e.type)).toEqual(['preview.added']);

      const p1 = json<{ items: ProjectEventView[]; nextCursor: string | null }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?limit=3`),
      );
      expect(p1.items).toHaveLength(3);
      expect(p1.nextCursor).not.toBeNull();
      const p2 = json<{ items: ProjectEventView[] }>(
        await call(buyer, 'GET', `/projects/${projectId}/events?limit=3&cursor=${p1.nextCursor}`),
      );
      expect(p2.items[0]!.id < p1.items.at(-1)!.id).toBe(true);
    });
  });

  describe('notifications', () => {
    it('submitting a milestone notifies the buyer in-app and by email; counts, read-state and isolation hold', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const before = json<{ unread: number }>(
        await call(buyer, 'GET', '/me/notifications/unread-count'),
      ).unread;
      await call(seller, 'POST', `/milestones/${milestoneIds[0]}/submit`, {});
      const after = json<{ unread: number }>(
        await call(buyer, 'GET', '/me/notifications/unread-count'),
      ).unread;
      expect(after).toBe(before + 1);
      const list = json<{ items: { id: string; type: string; url: string; readAt: string | null }[] }>(
        await call(buyer, 'GET', '/me/notifications'),
      );
      const n = list.items.find(
        (i) => i.type === 'milestone.submitted' && i.url === `/projects/${projectId}`,
      )!;
      expect(n.readAt).toBeNull();
      const mail = await findEmailJob(buyer.email, 'notification');
      expect(mail).toBeTruthy();

      // someone else cannot mark the buyer's notification read
      await call(other, 'POST', '/me/notifications/read', { ids: [n.id] });
      expect(
        json<{ unread: number }>(await call(buyer, 'GET', '/me/notifications/unread-count')).unread,
      ).toBe(after);
      expect(
        json<{ items: unknown[] }>(await call(other, 'GET', '/me/notifications')).items.some(
          (i) => (i as { id: string }).id === n.id,
        ),
      ).toBe(false);
      await call(buyer, 'POST', '/me/notifications/read', { ids: [n.id] });
      expect(
        json<{ unread: number }>(await call(buyer, 'GET', '/me/notifications/unread-count')).unread,
      ).toBe(after - 1);
      expect(json<{ unread: number }>(await call(buyer, 'POST', '/me/notifications/read', {})).unread).toBe(
        0,
      );
    });

    it('per-type preferences are respected for in-app and email, and only for the caller', async () => {
      const { milestoneIds } = await m.activeProject();
      const prefs = json<{ type: string; inApp: boolean; email: boolean; push: boolean }[]>(
        await call(buyer, 'GET', '/me/notification-preferences'),
      );
      expect(prefs.find((p) => p.type === 'milestone.submitted')).toMatchObject({ inApp: true, email: true });
      expect(prefs.find((p) => p.type === 'chat.message')).toMatchObject({ email: false });

      await call(buyer, 'PUT', '/me/notification-preferences', {
        prefs: [
          { type: 'milestone.submitted', inApp: false, email: false, push: false },
          { type: 'bogus.type', inApp: true, email: true, push: true },
        ],
      });
      const updated = json<{ type: string; inApp: boolean }[]>(
        await call(buyer, 'GET', '/me/notification-preferences'),
      );
      expect(updated.find((p) => p.type === 'milestone.submitted')!.inApp).toBe(false);
      expect(updated.some((p) => p.type === 'bogus.type')).toBe(false);
      expect(
        json<{ type: string; inApp: boolean }[]>(
          await call(seller, 'GET', '/me/notification-preferences'),
        ).find((p) => p.type === 'milestone.submitted')!.inApp,
      ).toBe(true);

      const before = json<{ unread: number }>(
        await call(buyer, 'GET', '/me/notifications/unread-count'),
      ).unread;
      await call(seller, 'POST', `/milestones/${milestoneIds[0]}/submit`, {});
      expect(
        json<{ unread: number }>(await call(buyer, 'GET', '/me/notifications/unread-count')).unread,
      ).toBe(before); // muted
      await call(buyer, 'PUT', '/me/notification-preferences', {
        prefs: [{ type: 'milestone.submitted', inApp: true, email: true, push: false }],
      });
    });

    it('push subscriptions: registered per user, moved on re-register, removed on request; disabled without VAPID keys', async () => {
      const sub = {
        endpoint: 'https://push.example.com/send/abc123',
        keys: { p256dh: 'BPublicKeyBPublicKeyBPublicKey', auth: 'authsecret1' },
      };
      expect((await call(null, 'POST', '/me/push-subscriptions', sub)).statusCode).toBe(401);
      expect(
        (await call(buyer, 'POST', '/me/push-subscriptions', { ...sub, endpoint: 'not-a-url' })).statusCode,
      ).toBe(400);
      expect((await call(buyer, 'POST', '/me/push-subscriptions', sub)).statusCode).toBe(201);
      expect((await call(seller, 'POST', '/me/push-subscriptions', sub)).statusCode).toBe(201); // same browser, new user
      const key = json<{ enabled: boolean; publicKey: string | null }>(
        await call(buyer, 'GET', '/push/public-key'),
      );
      expect(key).toEqual({ enabled: false, publicKey: null });
      const rows = await db.db.execute<{ user_id: string }>(
        sql`select user_id from push_subscriptions where endpoint = ${sub.endpoint}`,
      );
      expect(rows.rows.map((r) => r.user_id)).toEqual([seller.userId]);
      expect(
        (await call(buyer, 'DELETE', '/me/push-subscriptions', { endpoint: sub.endpoint })).statusCode,
      ).toBe(200); // not theirs: no-op
      expect(
        (await db.db.execute(sql`select 1 from push_subscriptions where endpoint = ${sub.endpoint}`)).rows,
      ).toHaveLength(1);
      expect(
        (await call(seller, 'DELETE', '/me/push-subscriptions', { endpoint: sub.endpoint })).statusCode,
      ).toBe(200);
      expect(
        (await db.db.execute(sql`select 1 from push_subscriptions where endpoint = ${sub.endpoint}`)).rows,
      ).toHaveLength(0);
    });
  });
});
