import { Logger } from '@nestjs/common';
import type { ApiEnv } from '../../config/env';

export interface RoomRequest {
  meetingId: string;
  startsAt: Date;
  endsAt: Date;
  /** True only when every participant consented. Providers must not record otherwise. */
  record: boolean;
}
export interface Room {
  roomName: string;
  roomUrl: string;
}
export interface JoinRequest {
  meetingId: string;
  roomName: string;
  roomUrl: string;
  user: { id: string; name: string };
  isOrganizer: boolean;
  record: boolean;
  endsAt: Date;
}

/** The only door to a video vendor. Swapping Daily for LiveKit means writing one new class. */
export abstract class VideoProvider {
  abstract readonly name: 'stub' | 'daily';
  abstract createRoom(req: RoomRequest): Promise<Room>;
  /** Returns a URL the participant opens to join. May be single-use/short-lived. */
  abstract joinUrl(req: JoinRequest): Promise<string>;
  abstract deleteRoom(roomName: string): Promise<void>;
}

/** Dev/CI: no video vendor. The web app shows a call page that explains the call would happen here. */
export class StubVideoProvider extends VideoProvider {
  readonly name = 'stub' as const;
  constructor(private readonly env: ApiEnv) {
    super();
  }
  async createRoom(req: RoomRequest): Promise<Room> {
    const roomName = `gw-${req.meetingId}`;
    return { roomName, roomUrl: `${this.env.WEB_URL}/meetings/${req.meetingId}/call` };
  }
  async joinUrl(req: JoinRequest): Promise<string> {
    return req.roomUrl;
  }
  async deleteRoom(): Promise<void> {}
}

/**
 * Daily.co via its REST API. ⚠ Unverified against the live service (no account yet): written from Daily's
 * documented REST shape (rooms + meeting tokens) and exercised only against a fake `fetch` in unit tests.
 */
export class DailyVideoProvider extends VideoProvider {
  readonly name = 'daily' as const;
  private readonly log = new Logger('DailyVideoProvider');
  constructor(
    private readonly env: ApiEnv,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    super();
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`https://api.daily.co/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${this.env.DAILY_API_KEY}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      this.log.warn(`Daily ${method} ${path} failed with ${res.status}`);
      throw new Error(`Video provider error (${res.status})`);
    }
    return (await res.json()) as T;
  }

  async createRoom(req: RoomRequest): Promise<Room> {
    const name = `gw-${req.meetingId}`;
    const room = await this.api<{ name: string; url: string }>('POST', '/rooms', {
      name,
      privacy: 'private',
      properties: {
        nbf: Math.floor((req.startsAt.getTime() - 30 * 60_000) / 1000),
        exp: Math.floor((req.endsAt.getTime() + 2 * 3_600_000) / 1000),
        enable_recording: req.record ? 'cloud' : undefined,
        enable_chat: true,
        eject_at_room_exp: true,
      },
    });
    return { roomName: room.name, roomUrl: room.url };
  }

  async joinUrl(req: JoinRequest): Promise<string> {
    const t = await this.api<{ token: string }>('POST', '/meeting-tokens', {
      properties: {
        room_name: req.roomName,
        user_name: req.user.name,
        user_id: req.user.id,
        is_owner: req.isOrganizer,
        exp: Math.floor((req.endsAt.getTime() + 2 * 3_600_000) / 1000),
        // Recording is started only by the owner's token, and only when the caller says everyone consented.
        start_cloud_recording: req.isOrganizer && req.record ? true : undefined,
      },
    });
    return `${req.roomUrl}?t=${encodeURIComponent(t.token)}`;
  }

  async deleteRoom(roomName: string): Promise<void> {
    await this.api('DELETE', `/rooms/${encodeURIComponent(roomName)}`).catch(() => undefined);
  }
}
