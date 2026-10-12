import { describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../../config/env';
import { DailyVideoProvider, StubVideoProvider } from './video.provider';

const env = { DAILY_API_KEY: 'dk_test', DAILY_DOMAIN: 'acme', WEB_URL: 'http://localhost:3000' } as ApiEnv;
const start = new Date('2026-11-02T14:00:00Z');
const end = new Date('2026-11-02T14:30:00Z');
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('DailyVideoProvider (fake fetch; the live API is unverified)', () => {
  it('creates a private room that expires after the meeting and only enables recording when asked', async () => {
    const f = vi.fn(() => ok({ name: 'gw-1', url: 'https://acme.daily.co/gw-1' }));
    const room = await new DailyVideoProvider(env, f as unknown as typeof fetch).createRoom({
      meetingId: '1',
      startsAt: start,
      endsAt: end,
      record: true,
    });
    expect(room).toEqual({ roomName: 'gw-1', roomUrl: 'https://acme.daily.co/gw-1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.daily.co/v1/rooms');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer dk_test');
    const body = JSON.parse(init.body as string);
    expect(body.privacy).toBe('private');
    expect(body.properties.enable_recording).toBe('cloud');
    expect(body.properties.exp).toBe(Math.floor((end.getTime() + 2 * 3_600_000) / 1000));

    const f2 = vi.fn(() => ok({ name: 'gw-2', url: 'https://acme.daily.co/gw-2' }));
    await new DailyVideoProvider(env, f2 as unknown as typeof fetch).createRoom({
      meetingId: '2',
      startsAt: start,
      endsAt: end,
      record: false,
    });
    const sent = JSON.parse((f2.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.properties.enable_recording).toBeUndefined();
  });

  it('mints a per-person token; only the organizer token can start a recording, and only with consent', async () => {
    const f = vi.fn(() => ok({ token: 'tok/123' }));
    const p = new DailyVideoProvider(env, f as unknown as typeof fetch);
    const base = {
      meetingId: '1',
      roomName: 'gw-1',
      roomUrl: 'https://acme.daily.co/gw-1',
      user: { id: 'u1', name: 'Sam' },
      endsAt: end,
    };
    const url = await p.joinUrl({ ...base, isOrganizer: true, record: true });
    expect(url).toBe('https://acme.daily.co/gw-1?t=tok%2F123');
    const first = JSON.parse(
      (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ).properties;
    expect(first).toMatchObject({
      room_name: 'gw-1',
      user_name: 'Sam',
      is_owner: true,
      start_cloud_recording: true,
    });
    await p.joinUrl({ ...base, isOrganizer: false, record: true });
    expect(
      JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).properties
        .start_cloud_recording,
    ).toBeUndefined();
    await p.joinUrl({ ...base, isOrganizer: true, record: false });
    expect(
      JSON.parse((f.mock.calls[2] as unknown as [string, RequestInit])[1].body as string).properties
        .start_cloud_recording,
    ).toBeUndefined();
  });

  it('turns vendor failures into a clean error without leaking the key', async () => {
    const f = vi.fn(() => Promise.resolve(new Response('nope', { status: 401 })));
    const err = await new DailyVideoProvider(env, f as unknown as typeof fetch)
      .createRoom({ meetingId: '1', startsAt: start, endsAt: end, record: false })
      .catch((e: Error) => e);
    expect((err as Error).message).toBe('Video provider error (401)');
    expect((err as Error).message).not.toMatch(/dk_test/);
  });
});

describe('StubVideoProvider', () => {
  it('points at the in-app call page', async () => {
    const s = new StubVideoProvider(env);
    const room = await s.createRoom({ meetingId: 'abc', startsAt: start, endsAt: end, record: false });
    expect(room.roomUrl).toBe('http://localhost:3000/meetings/abc/call');
    expect(
      await s.joinUrl({
        meetingId: 'abc',
        roomName: room.roomName,
        roomUrl: room.roomUrl,
        user: { id: 'u', name: 'n' },
        isOrganizer: false,
        record: false,
        endsAt: end,
      }),
    ).toBe(room.roomUrl);
  });
});
