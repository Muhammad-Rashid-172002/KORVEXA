import { describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../../config/env';
import { WebPushSender } from './push.sender';

const keys = {
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  VAPID_SUBJECT: 'mailto:ops@example.test',
} as ApiEnv;
const target = { endpoint: 'https://push.example.com/abc', p256dh: 'k', auth: 'a' };
const payload = { title: 'Milestone ready', body: null, url: 'http://localhost:3000/projects/1' };

describe('WebPushSender', () => {
  it('is disabled and never calls the push service without VAPID keys', async () => {
    const lib = { sendNotification: vi.fn(), setVapidDetails: vi.fn() };
    const sender = new WebPushSender({ VAPID_SUBJECT: 'mailto:x@y.z' } as ApiEnv, lib);
    expect(sender.enabled).toBe(false);
    expect(await sender.send(target, payload)).toBe('failed');
    expect(lib.sendNotification).not.toHaveBeenCalled();
    expect(lib.setVapidDetails).not.toHaveBeenCalled();
  });

  it('configures VAPID once and sends a JSON payload with a TTL', async () => {
    const lib = { sendNotification: vi.fn().mockResolvedValue({}), setVapidDetails: vi.fn() };
    const sender = new WebPushSender(keys, lib);
    expect(sender.enabled).toBe(true);
    expect(lib.setVapidDetails).toHaveBeenCalledWith('mailto:ops@example.test', 'pub', 'priv');
    expect(await sender.send(target, payload)).toBe('sent');
    expect(lib.sendNotification).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: 'k', auth: 'a' } },
      JSON.stringify(payload),
      { TTL: 3600 },
    );
  });

  it('reports expired subscriptions (404/410) as gone so they can be deleted, other errors as failed', async () => {
    const make = (statusCode: number) =>
      new WebPushSender(keys, {
        sendNotification: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { statusCode })),
        setVapidDetails: vi.fn(),
      });
    expect(await make(410).send(target, payload)).toBe('gone');
    expect(await make(404).send(target, payload)).toBe('gone');
    expect(await make(500).send(target, payload)).toBe('failed');
  });
});
