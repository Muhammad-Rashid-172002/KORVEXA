import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  SOCKET_PATH,
  userRoom,
} from '@glasswork/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SessionService, type RequestActor } from '../../auth/session.service';
import { Policy } from '../../common/policy/decorators';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { actor: RequestActor }>;

/**
 * Authenticated Socket.io gateway. The handshake must carry a valid session cookie (or bearer token);
 * unauthenticated sockets are rejected before `connection`. Each user joins `user:{id}`.
 */
@WebSocketGateway({ path: SOCKET_PATH })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly sessions: SessionService) {}

  afterInit(server: Server): void {
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
    socket.emit('session:ready', { userId: actor.userId, socketId: socket.id });
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
}
