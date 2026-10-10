import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { Mailer } from '../mailer';
import { createEmailProcessor } from './email.processor';

describe('email processor', () => {
  it('renders and sends a verification email', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'm1' });
    const mailer: Mailer = { transport: 'smtp', send };
    const job = { data: { template: 'verify-email', to: 'a@b.co', data: { name: 'A', url: 'http://x.test/v?t=1' } } } as Job;
    await expect(createEmailProcessor(mailer)(job)).resolves.toEqual({ id: 'm1' });
    expect(send).toHaveBeenCalledWith('a@b.co', expect.objectContaining({ subject: expect.any(String), html: expect.stringContaining('http://x.test/v?t=1') }));
  });
  it('rejects malformed jobs so they fail loudly', async () => {
    const mailer: Mailer = { transport: 'smtp', send: vi.fn() };
    await expect(createEmailProcessor(mailer)({ data: { template: 'nope' } } as Job)).rejects.toThrow();
  });
});
