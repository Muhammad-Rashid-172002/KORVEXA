import {
  conversationRoom,
  projectRoom,
  userRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@glasswork/shared';
import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Server-side emitter used by services. The gateway registers the Socket.io server once it starts. */
@Injectable()
export class RealtimeService {
  private server: AppServer | null = null;

  register(server: AppServer) {
    this.server = server;
  }

  toUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    (this.server?.to(userRoom(userId)) as { emit: (e: string, ...a: unknown[]) => void } | undefined)?.emit(
      event,
      ...args,
    );
  }

  toProject<E extends keyof ServerToClientEvents>(
    projectId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    (
      this.server?.to(projectRoom(projectId)) as { emit: (e: string, ...a: unknown[]) => void } | undefined
    )?.emit(event, ...args);
  }

  toConversation<E extends keyof ServerToClientEvents>(
    conversationId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    (
      this.server?.to(conversationRoom(conversationId)) as
        { emit: (e: string, ...a: unknown[]) => void } | undefined
    )?.emit(event, ...args);
  }
}
