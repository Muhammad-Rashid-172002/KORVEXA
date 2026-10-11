import type {
  ChatMessageView,
  ClientToServerEvents,
  ConversationView,
  MessagePageView,
  NotificationView,
  ProjectView,
  ServerToClientEvents,
} from '@glasswork/shared';
import { SOCKET_PATH } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Redis } from 'ioredis';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REDIS } from '../src/infra/tokens';
import { bootMarket, createFile, createTestApp, idemKey, signUpVerified, type TestUser } from './helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('Phase 4: chat, custom offers and realtime', () => {
  let app: NestFastifyApplication;
  let m: Awaited<ReturnType<typeof bootMarket>>;
  let call: typeof m.call;
  let json: typeof m.json;
  let seller: TestUser;
  let buyer: TestUser;
  let other: TestUser;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  const connect = async (u: TestUser): Promise<ClientSocket> => {
    const s: ClientSocket = io(baseUrl, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      extraHeaders: { cookie: u.cookie },
      reconnection: false,
      forceNew: true,
    });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.on('session:ready', () => resolve());
      s.on('connect_error', reject);
    });
    return s;
  };
  const next = <E extends keyof ServerToClientEvents>(s: ClientSocket, event: E, ms = 3000) =>
    new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timed out waiting for ${String(event)}`)), ms);
      (s as Socket).once(event as string, (p: unknown) => {
        clearTimeout(t);
        resolve(p as Parameters<ServerToClientEvents[E]>[0]);
      });
    });
  /** True if the event does NOT arrive within the window. */
  const silent = (s: ClientSocket, event: keyof ServerToClientEvents, ms = 400) =>
    new Promise<boolean>((resolve) => {
      let got = false;
      (s as Socket).once(event as string, () => (got = true));
      setTimeout(() => resolve(!got), ms);
    });
  const join = (s: ClientSocket, target: { conversationId: string } | { projectId: string }) =>
    new Promise<{ ok: boolean; online?: string[] }>((resolve) => s.emit('room:join', target, resolve));

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    m = await bootMarket(app);
    ({ call, json, seller, buyer, other } = m);
  });
  afterAll(async () => {
    sockets.forEach((s) => s.close());
    // Let the server's disconnect handlers (Redis presence cleanup) finish before the app shuts Redis down.
    await new Promise((r) => setTimeout(r, 500));
    await app?.close();
  });

  const projectChat = async (u: TestUser, projectId: string) =>
    json<MessagePageView>(await call(u, 'GET', `/projects/${projectId}/chat`));
  const send = (u: TestUser, conversationId: string, body: unknown) =>
    call(u, 'POST', `/conversations/${conversationId}/messages`, body);

  describe('REST', () => {
    it('project chat is created for exactly the participants; outsiders get 404 on every route', async () => {
      const { projectId } = await m.activeProject();
      const chat = await projectChat(buyer, projectId);
      expect(chat.members.map((x) => x.userId).sort()).toEqual([buyer.userId, seller.userId].sort());
      expect((await projectChat(seller, projectId)).conversationId).toBe(chat.conversationId);
      const cid = chat.conversationId;
      expect((await call(null, 'GET', `/projects/${projectId}/chat`)).statusCode).toBe(401);
      expect((await call(other, 'GET', `/projects/${projectId}/chat`)).statusCode).toBe(404);
      expect((await call(other, 'GET', `/conversations/${cid}/messages`)).statusCode).toBe(404);
      expect((await send(other, cid, { body: 'let me in' })).statusCode).toBe(404);
      expect((await call(other, 'POST', `/conversations/${cid}/read`, { messageId: cid })).statusCode).toBe(
        404,
      );
      expect(json<ConversationView[]>(await call(other, 'GET', '/me/conversations'))).toHaveLength(0);
    });

    it('sends, paginates and counts unread; read receipts only move forward and only for members', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      expect((await send(buyer, cid, { body: '' })).statusCode).toBe(400);
      expect((await send(buyer, cid, { body: 'x'.repeat(4001) })).statusCode).toBe(400);
      const ids: string[] = [];
      for (const body of ['Hello!', 'Quick question about milestone 1', 'Thanks']) {
        const r = await send(buyer, cid, { body });
        expect(r.statusCode).toBe(201);
        ids.push(json<ChatMessageView>(r).id);
      }
      const reply = json<ChatMessageView>(await send(seller, cid, { body: 'Sure, ask away' }));

      const list = json<ConversationView[]>(await call(seller, 'GET', '/me/conversations')).find(
        (c) => c.id === cid,
      )!;
      expect(list.unread).toBe(3);
      expect(list.lastMessage?.body).toBe('Sure, ask away');
      expect(
        json<ConversationView[]>(await call(buyer, 'GET', '/me/conversations')).find((c) => c.id === cid)!
          .unread,
      ).toBe(1);

      const p1 = json<MessagePageView>(await call(buyer, 'GET', `/conversations/${cid}/messages?limit=2`));
      expect(p1.items.map((x) => x.body)).toEqual(['Thanks', 'Sure, ask away']); // oldest-first within the page
      const p2 = json<MessagePageView>(
        await call(buyer, 'GET', `/conversations/${cid}/messages?limit=2&cursor=${p1.nextCursor}`),
      );
      expect(p2.items.map((x) => x.body)).toEqual(['Hello!', 'Quick question about milestone 1']);

      await call(seller, 'POST', `/conversations/${cid}/read`, { messageId: ids[2] });
      expect(
        json<ConversationView[]>(await call(seller, 'GET', '/me/conversations')).find((c) => c.id === cid)!
          .unread,
      ).toBe(0);
      await call(seller, 'POST', `/conversations/${cid}/read`, { messageId: ids[0] }); // older: ignored
      const members = (await projectChat(seller, projectId)).members;
      expect(members.find((x) => x.userId === seller.userId)!.lastReadMessageId).toBe(ids[2]);
      expect(
        (await call(seller, 'POST', `/conversations/${cid}/read`, { messageId: reply.id.replace(/.$/, '0') }))
          .statusCode,
      ).toBe(404); // not a message of this chat
    });

    it('attachments: own clean message files only; readable by conversation members, nobody else', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const mine = await createFile(app, buyer, 'message', { name: 'spec.pdf' });
      const sellers = await createFile(app, seller, 'message');
      const pending = await createFile(app, buyer, 'message', { status: 'uploaded' });
      const wrong = await createFile(app, buyer, 'portfolio');

      expect((await send(buyer, cid, { fileIds: [sellers] })).statusCode).toBe(404); // someone else's file
      expect((await send(buyer, cid, { fileIds: [pending] })).statusCode).toBe(404);
      expect((await send(buyer, cid, { fileIds: [wrong] })).statusCode).toBe(404);
      const ok = await send(buyer, cid, { body: 'Here is the spec', fileIds: [mine] });
      expect(ok.statusCode).toBe(201);
      expect(json<ChatMessageView>(ok).attachments[0]).toMatchObject({ id: mine, name: 'spec.pdf' });

      expect(json<{ url: string }>(await call(seller, 'GET', `/files/${mine}/download`)).url).toContain(mine);
      expect((await call(other, 'GET', `/files/${mine}/download`)).statusCode).toBe(404);
      expect((await call(seller, 'GET', `/me/files/${mine}`)).statusCode).toBe(404);
    });

    it('rate limits messages per user (429 after 30 in a minute)', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      await app.get<Redis>(REDIS).del(`rl:chat:${buyer.userId}`);
      const codes: number[] = [];
      for (let i = 0; i < 32; i++) codes.push((await send(buyer, cid, { body: `msg ${i}` })).statusCode);
      expect(codes.slice(0, 30).every((c) => c === 201)).toBe(true);
      expect(codes.slice(30)).toEqual([429, 429]);
      await app.get<Redis>(REDIS).del(`rl:chat:${buyer.userId}`);
    });

    it('notifies the recipient once per conversation (collapsed), not once per message', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      await app.get<Redis>(REDIS).del(`rl:chat:${buyer.userId}`);
      await call(seller, 'POST', '/me/notifications/read', {});
      for (const body of ['one', 'two', 'three']) await send(buyer, cid, { body });
      const items = json<{ items: NotificationView[] }>(
        await call(seller, 'GET', '/me/notifications'),
      ).items.filter((i) => i.type === 'chat.message');
      const unread = items.filter((i) => i.readAt === null);
      expect(unread).toHaveLength(1);
      expect(unread[0]!.body).toBe('three');
      expect(unread[0]!.url).toBe(`/projects/${projectId}?tab=chat`);
    });
  });

  describe('direct chats and custom offers', () => {
    let freeBuyer: TestUser;
    let cid: string;

    beforeAll(async () => {
      freeBuyer = await signUpVerified(app, { name: 'Direct Buyer' });
      const r = await call(freeBuyer, 'POST', '/conversations/direct', { userId: seller.userId });
      expect(r.statusCode).toBe(201);
      cid = json<{ conversationId: string }>(r).conversationId;
    });

    it('buyers contact published sellers only; one conversation per pair; no self-chat', async () => {
      expect(
        json<{ conversationId: string }>(
          await call(freeBuyer, 'POST', '/conversations/direct', { userId: seller.userId }),
        ).conversationId,
      ).toBe(cid);
      expect(
        json<{ conversationId: string }>(
          await call(seller, 'POST', '/conversations/direct', { userId: freeBuyer.userId }),
        ).conversationId,
      ).toBe(cid);
      expect(
        (await call(freeBuyer, 'POST', '/conversations/direct', { userId: freeBuyer.userId })).statusCode,
      ).toBe(422);
      expect(
        (await call(freeBuyer, 'POST', '/conversations/direct', { userId: other.userId })).statusCode,
      ).toBe(404); // not a seller
      expect(
        (
          await call(freeBuyer, 'POST', '/conversations/direct', {
            userId: '00000000-0000-7000-8000-000000000000',
          })
        ).statusCode,
      ).toBe(404);
      expect((await call(null, 'POST', '/conversations/direct', { userId: seller.userId })).statusCode).toBe(
        401,
      );
      expect((await call(other, 'GET', `/conversations/${cid}/messages`)).statusCode).toBe(404);
    });

    const plan = [
      { title: 'Prototype', amount: 60_000, days: 7 },
      { title: 'Launch', amount: 90_000, days: 14 },
    ];

    it('only a published seller sends offers, only in direct chats; the buyer accepts into a project once', async () => {
      const offer = {
        title: 'Custom storefront build',
        description: 'A tailored storefront with the features we discussed.',
        milestonePlan: plan,
      };
      expect((await call(freeBuyer, 'POST', `/conversations/${cid}/offers`, offer)).statusCode).toBe(422); // not a seller
      expect((await call(other, 'POST', `/conversations/${cid}/offers`, offer)).statusCode).toBe(404);
      expect(
        (
          await call(seller, 'POST', `/conversations/${cid}/offers`, {
            ...offer,
            milestonePlan: [{ title: 'x', amount: 5, days: 1 }],
          })
        ).statusCode,
      ).toBe(400);
      const { projectId } = await m.activeProject();
      const projCid = (await projectChat(buyer, projectId)).conversationId;
      expect((await call(seller, 'POST', `/conversations/${projCid}/offers`, offer)).statusCode).toBe(422); // project chat

      const sent = await call(seller, 'POST', `/conversations/${cid}/offers`, offer);
      expect(sent.statusCode).toBe(201);
      const msg = json<ChatMessageView>(sent);
      expect(msg.kind).toBe('custom_offer');
      expect(msg.offer).toMatchObject({
        title: 'Custom storefront build',
        totalAmount: 150_000,
        status: 'sent',
      });
      expect(
        json<{ items: NotificationView[] }>(await call(freeBuyer, 'GET', '/me/notifications')).items.some(
          (n) => n.type === 'offer.received',
        ),
      ).toBe(true);

      const offerId = msg.offer!.id;
      const key = idemKey('offer');
      expect(
        (await call(seller, 'POST', `/offers/${offerId}/accept`, undefined, { 'idempotency-key': key }))
          .statusCode,
      ).toBe(404); // sellers can't accept
      expect(
        (await call(other, 'POST', `/offers/${offerId}/accept`, undefined, { 'idempotency-key': key }))
          .statusCode,
      ).toBe(404);
      expect((await call(freeBuyer, 'POST', `/offers/${offerId}/accept`)).statusCode).toBe(400); // key required
      const acc = await call(freeBuyer, 'POST', `/offers/${offerId}/accept`, undefined, {
        'idempotency-key': key,
      });
      expect(acc.statusCode, acc.body).toBe(201);
      const created = json<{ projectId: string }>(acc);
      expect(
        json<{ projectId: string }>(
          await call(freeBuyer, 'POST', `/offers/${offerId}/accept`, undefined, { 'idempotency-key': key }),
        ).projectId,
      ).toBe(created.projectId);
      expect(
        (
          await call(freeBuyer, 'POST', `/offers/${offerId}/accept`, undefined, {
            'idempotency-key': idemKey('again'),
          })
        ).statusCode,
      ).toBe(422);

      const p = json<ProjectView>(await call(freeBuyer, 'GET', `/projects/${created.projectId}`));
      expect(p.milestones.map((x) => x.amount)).toEqual([60_000, 90_000]);
      expect(p.totalAmount).toBe(150_000);
      expect(p.seller.name).toBe('Seller');
      expect((await call(other, 'GET', `/projects/${created.projectId}`)).statusCode).toBe(404);
      const history = json<MessagePageView>(
        await call(freeBuyer, 'GET', `/conversations/${cid}/messages`),
      ).items;
      expect(history.at(-1)).toMatchObject({ kind: 'system' });
      expect(history.find((x) => x.kind === 'custom_offer')!.offer!.status).toBe('accepted');
    });

    it('decline (buyer) and withdraw (seller) are role-scoped and final', async () => {
      const offer = {
        title: 'Another custom offer',
        description: 'A second tailored offer for the same buyer.',
        milestonePlan: plan,
      };
      const a = json<ChatMessageView>(await call(seller, 'POST', `/conversations/${cid}/offers`, offer))
        .offer!.id;
      expect((await call(seller, 'POST', `/offers/${a}/decline`)).statusCode).toBe(404);
      expect((await call(freeBuyer, 'POST', `/offers/${a}/withdraw`)).statusCode).toBe(404);
      expect(json<{ status: string }>(await call(freeBuyer, 'POST', `/offers/${a}/decline`)).status).toBe(
        'declined',
      );
      expect((await call(freeBuyer, 'POST', `/offers/${a}/decline`)).statusCode).toBe(422);
      expect(
        (await call(freeBuyer, 'POST', `/offers/${a}/accept`, undefined, { 'idempotency-key': idemKey() }))
          .statusCode,
      ).toBe(422);

      const b = json<ChatMessageView>(await call(seller, 'POST', `/conversations/${cid}/offers`, offer))
        .offer!.id;
      expect(json<{ status: string }>(await call(seller, 'POST', `/offers/${b}/withdraw`)).status).toBe(
        'withdrawn',
      );
      expect(
        (await call(freeBuyer, 'POST', `/offers/${b}/accept`, undefined, { 'idempotency-key': idemKey() }))
          .statusCode,
      ).toBe(422);
    });
  });

  describe('Socket.io', () => {
    it('room joins are authorised: members are in, outsiders and garbage are refused identically', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const sb = await connect(buyer);
      const so = await connect(other);
      expect((await join(sb, { conversationId: cid })).ok).toBe(true);
      expect((await join(sb, { projectId })).ok).toBe(true);
      expect(await join(so, { conversationId: cid })).toEqual({ ok: false });
      expect(await join(so, { projectId })).toEqual({ ok: false });
      expect(await join(so, { conversationId: '00000000-0000-7000-8000-000000000000' })).toEqual({
        ok: false,
      });
      expect(await join(sb, { conversationId: 'not-a-uuid' } as never)).toEqual({ ok: false });
      expect(await join(sb, {} as never)).toEqual({ ok: false });
    });

    it('delivers messages in real time to members only', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const ss = await connect(seller);
      const sb = await connect(buyer);
      const so = await connect(other);
      await join(ss, { conversationId: cid });
      await join(sb, { conversationId: cid });
      await join(so, { conversationId: cid }); // refused

      const gotSeller = next(ss, 'chat:message');
      const outsiderQuiet = silent(so, 'chat:message');
      await send(buyer, cid, { body: 'live message' });
      expect((await gotSeller).body).toBe('live message');
      expect(await outsiderQuiet).toBe(true);
    });

    it('relays typing only from sockets that joined the room, never to the typist or outsiders', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const ss = await connect(seller);
      const sb = await connect(buyer);
      const so = await connect(other);
      await join(ss, { conversationId: cid });
      await join(sb, { conversationId: cid });

      const typing = next(ss, 'chat:typing');
      const typistQuiet = silent(sb, 'chat:typing');
      sb.emit('chat:typing', { conversationId: cid, typing: true });
      expect(await typing).toEqual({ conversationId: cid, userId: buyer.userId, typing: true });
      expect(await typistQuiet).toBe(true);

      // An outsider cannot inject typing into a room it never joined.
      const quiet = silent(ss, 'chat:typing');
      so.emit('chat:typing', { conversationId: cid, typing: true });
      so.emit('chat:typing', { conversationId: 'garbage', typing: 'yes' } as never);
      expect(await quiet).toBe(true);
    });

    it('broadcasts read receipts and rejects outsiders', async () => {
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const msg = json<ChatMessageView>(await send(buyer, cid, { body: 'please read me' }));
      const ss = await connect(seller);
      const sb = await connect(buyer);
      const so = await connect(other);
      await join(ss, { conversationId: cid });
      await join(sb, { conversationId: cid });

      const receipt = next(sb, 'chat:read');
      const ack = await new Promise<{ ok: boolean }>((resolve) =>
        ss.emit('chat:read', { conversationId: cid, messageId: msg.id }, resolve as never),
      );
      expect(ack.ok).toBe(true);
      expect(await receipt).toEqual({
        conversationId: cid,
        userId: seller.userId,
        lastReadMessageId: msg.id,
      });
      const denied = await new Promise<{ ok: boolean }>((resolve) =>
        so.emit('chat:read', { conversationId: cid, messageId: msg.id }, resolve as never),
      );
      expect(denied.ok).toBe(false);
    });

    it('tracks presence: online list on join, update on join and when the last socket disconnects', async () => {
      // Presence is per user: drop sockets left open by earlier tests so the seller really is offline.
      sockets.splice(0).forEach((s) => s.close());
      await new Promise((r) => setTimeout(r, 400));
      const { projectId } = await m.activeProject();
      const cid = (await projectChat(buyer, projectId)).conversationId;
      const sb = await connect(buyer);
      const first = await join(sb, { conversationId: cid });
      expect(first.online).toContain(buyer.userId);
      expect(first.online).not.toContain(seller.userId);

      const cameOnline = next(sb, 'presence:update');
      const ss = await connect(seller);
      const second = await join(ss, { conversationId: cid });
      expect(second.online?.sort()).toEqual([buyer.userId, seller.userId].sort());
      expect(await cameOnline).toEqual({ userId: seller.userId, online: true });

      const wentOffline = next(sb, 'presence:update');
      ss.close();
      expect(await wentOffline).toEqual({ userId: seller.userId, online: false });
    });

    it('pushes project events to participants and notifications to the user room', async () => {
      const { projectId, milestoneIds } = await m.activeProject();
      const sb = await connect(buyer);
      const so = await connect(other);
      expect((await join(sb, { projectId })).ok).toBe(true);
      await join(so, { projectId });

      const event = next(sb, 'project:event');
      const notification = next(sb, 'notification:new');
      const outsiderQuiet = silent(so, 'project:event');
      await call(seller, 'POST', `/milestones/${milestoneIds[0]}/submit`, {});
      expect((await event).projectId).toBe(projectId);
      const n = await notification;
      expect(n).toMatchObject({ type: 'milestone.submitted', url: `/projects/${projectId}` });
      expect(await outsiderQuiet).toBe(true);
    });
  });
});
