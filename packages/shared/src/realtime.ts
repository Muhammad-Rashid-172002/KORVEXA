/** Typed Socket.io contract shared by api gateway and web client. */
export interface ServerToClientEvents {
  'session:ready': (payload: { userId: string; socketId: string }) => void;
  pong: (payload: { at: string; echo?: string }) => void;
}

export interface ClientToServerEvents {
  ping: (payload: { echo?: string }, ack: (res: { ok: true; at: string }) => void) => void;
}

export const SOCKET_PATH = '/v1/realtime';
export const userRoom = (userId: string) => `user:${userId}`;
