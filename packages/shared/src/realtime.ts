/** Typed Socket.io contract shared by api gateway and web client. */
export interface ChatMessageView {
  id: string;
  conversationId: string;
  sender: { id: string | null; name: string };
  body: string;
  kind: 'text' | 'custom_offer' | 'system';
  offer: {
    id: string;
    title: string;
    description: string;
    totalAmount: number;
    currency: string;
    status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
    milestonePlan: { title: string; amount: number; days: number }[];
    projectId: string | null;
  } | null;
  attachments: { id: string; name: string; sizeBytes: number; mimeType: string }[];
  /** Off-platform contact/payment details detected before an order existed (warn + log, never block). */
  safetyFlags: ('email' | 'phone' | 'external_chat' | 'offsite_payment')[];
  createdAt: string;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ServerToClientEvents {
  'session:ready': (payload: { userId: string; socketId: string }) => void;
  pong: (payload: { at: string; echo?: string }) => void;
  'notification:new': (payload: NotificationView) => void;
  /** Something changed in a project the user participates in; clients refresh the affected view. */
  'project:event': (payload: { projectId: string; type: string }) => void;
  'chat:message': (payload: ChatMessageView) => void;
  'chat:typing': (payload: { conversationId: string; userId: string; typing: boolean }) => void;
  'chat:read': (payload: { conversationId: string; userId: string; lastReadMessageId: string }) => void;
  'presence:update': (payload: { userId: string; online: boolean }) => void;
}

export type JoinTarget = { conversationId: string } | { projectId: string };

export interface ClientToServerEvents {
  ping: (payload: { echo?: string }, ack: (res: { ok: true; at: string }) => void) => void;
  /** Join a conversation/project room. The server verifies membership; the ack never reveals why it failed. */
  'room:join': (payload: JoinTarget, ack: (res: { ok: boolean; online?: string[] }) => void) => void;
  'chat:typing': (payload: { conversationId: string; typing: boolean }) => void;
  'chat:read': (
    payload: { conversationId: string; messageId: string },
    ack?: (res: { ok: boolean }) => void,
  ) => void;
}

export const SOCKET_PATH = '/v1/realtime';
export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (id: string) => `conv:${id}`;
export const projectRoom = (id: string) => `project:${id}`;
