import {
  conversationRoom,
  projectRoom,
  SOCKET_PATH,
  userRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@glasswork/shared';
import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { SessionService, type RequestActor } from '../../auth/session.service';
import { Policy } from '../../common/policy/decorators';
import { REDIS } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { ChatService } from '../chat/chat.service';
import { RealtimeService } from './realtime.service';

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  { actor: RequestActor }
>;

// Everything a client sends is untrusted: validate before touching the database.
const joinSchema = z.union([z.object({ conversationId: z.uuid() }), z.object({ projectId: z.uuid() })]);
const typingSchema = z.object({ conversationId: z.uuid(), typing: z.boolean() });
const readSchema = z.object({ conversationId: z.uuid(), messageId: z.uuid() });

const presenceKey = (userId: string) => `presence:${userId}`;
const PRESENCE_TTL_SECONDS = 6 * 60 * 60;

/**
 * Authenticated Socket.io gateway. The handshake must carry a valid session cookie (or bearer token);
 * unauthenticated sockets are rejected before `connection`. Each user joins `user:{id}`; conversation and
 * project rooms are joined only after the server verifies membership, and typing/read events are only
 * accepted for rooms the socket legitimately joined.
 */
@WebSocketGateway({ path: SOCKET_PATH })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  private server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(
    private readonly sessions: SessionService,
    private readonly access: AccessService,
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  afterInit(server: Server<ClientToServerEvents, ServerToClientEvents>): void {
    this.server = server;
    this.realtime.register(server);
    server.use((socket, next) => {
      const headers = { ...socket.handshake.headers };
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token === 'string' && !headers.authorization) headers.authorization = `Bearer ${token}`;
      this.sessions
        .resolve(headers)
        .then((actor) => {
          if (!actor) return next(new Error('unauthorized'));
          (socket as AppSocket).data.actor = actor;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  async handleConnection(socket: AppSocket): Promise<void> {
    const { actor } = socket.data;
    await socket.join(userRoom(actor.userId));
    await this.redis.sadd(presenceKey(actor.userId), socket.id);
    await this.redis.expire(presenceKey(actor.userId), PRESENCE_TTL_SECONDS);
    socket.emit('session:ready', { userId: actor.userId, socketId: socket.id });

    // `disconnecting` still has the rooms; tell them the user went offline once their LAST socket is gone.
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((r) => r.startsWith('conv:') || r.startsWith('project:'));
      void (async () => {
        await this.redis.srem(presenceKey(actor.userId), socket.id);
        if ((await this.redis.scard(presenceKey(actor.userId))) === 0) {
          for (const room of rooms)
            this.server.to(room).emit('presence:update', { userId: actor.userId, online: false });
        }
      })().catch(() => undefined);
    });
    this.logger.debug(`socket ${socket.id} connected for user ${actor.userId}`);
  }

  @Policy('any authenticated socket (auth enforced in the handshake)')
  @SubscribeMessage('ping')
  ping(@ConnectedSocket() socket: AppSocket, @MessageBody() body: { echo?: unknown } | undefined) {
    const at = new Date().toISOString();
    const echo = typeof body?.echo === 'string' ? body.echo.slice(0, 200) : undefined;
    socket.emit('pong', { at, echo });
    return { ok: true as const, at };
  }

  @Policy('a socket joins a conversation/project room only if its user is a member/participant')
  @SubscribeMessage('room:join')
  async join(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const parsed = joinSchema.safeParse(body);
    const denied = { ok: false as const }; // identical for malformed, unknown and forbidden targets
    if (!parsed.success) return denied;
    const { userId } = socket.data.actor;

    let room: string;
    let memberIds: string[];
    if ('conversationId' in parsed.data) {
      if (!(await this.access.isConversationMember(userId, parsed.data.conversationId))) return denied;
      room = conversationRoom(parsed.data.conversationId);
      memberIds = await this.access.conversationMemberIds(parsed.data.conversationId);
    } else {
      if (!(await this.access.projectRole(userId, parsed.data.projectId))) return denied;
      room = projectRoom(parsed.data.projectId);
      memberIds = await this.access.projectParticipantIds(parsed.data.projectId);
    }
    await socket.join(room);
    await this.redis.expire(presenceKey(userId), PRESENCE_TTL_SECONDS);
    socket.to(room).emit('presence:update', { userId, online: true });
    const online: string[] = [];
    for (const id of memberIds) if ((await this.redis.scard(presenceKey(id))) > 0) online.push(id);
    return { ok: true as const, online };
  }

  @Policy('typing is only relayed for conversation rooms this socket legitimately joined')
  @SubscribeMessage('chat:typing')
  typing(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const parsed = typingSchema.safeParse(body);
    if (!parsed.success) return;
    const room = conversationRoom(parsed.data.conversationId);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit('chat:typing', {
      conversationId: parsed.data.conversationId,
      userId: socket.data.actor.userId,
      typing: parsed.data.typing,
    });
  }

  @Policy('read receipts are recorded for the socket user only, after a membership check')
  @SubscribeMessage('chat:read')
  async read(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown) {
    const parsed = readSchema.safeParse(body);
    if (!parsed.success) return { ok: false };
    try {
      await this.chat.markRead(socket.data.actor, parsed.data.conversationId, parsed.data.messageId);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
