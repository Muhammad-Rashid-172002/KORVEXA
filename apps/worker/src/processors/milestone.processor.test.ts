import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { createMilestoneProcessor } from './milestone.processor';

const cfg = { API_INTERNAL_URL: 'http://api:4000', INTERNAL_API_TOKEN: 'secret-token-0123456789abcd' };
const id = '0197c1a0-0000-7000-8000-000000000001';
const job = (data: unknown) => ({ data }) as Job;
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('milestone processor', () => {
  it('calls the internal auto-approve route with the shared token', async () => {
    const fetchFn = vi.fn(() => ok({ result: 'approved' }));
    const out = await createMilestoneProcessor(
      cfg,
      fetchFn as unknown as typeof fetch,
    )(job({ kind: 'auto-approve', milestoneId: id }));
    expect(out).toEqual({ result: 'approved' });
    expect(fetchFn).toHaveBeenCalledWith(`http://api:4000/v1/internal/milestones/${id}/auto-approve`, {
      method: 'POST',
      headers: { 'x-internal-token': cfg.INTERNAL_API_TOKEN },
    });
  });

  it('routes reminders to /remind', async () => {
    const fetchFn = vi.fn((url: string | URL | Request) => {
      void url;
      return ok({ sent: true });
    });
    await createMilestoneProcessor(
      cfg,
      fetchFn as unknown as typeof fetch,
    )(job({ kind: 'reminder', milestoneId: id }));
    expect(String(fetchFn.mock.calls[0]![0])).toMatch(/\/remind$/);
  });

  it('throws on a non-2xx response so BullMQ retries', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('nope', { status: 503 })));
    await expect(
      createMilestoneProcessor(
        cfg,
        fetchFn as unknown as typeof fetch,
      )(job({ kind: 'auto-approve', milestoneId: id })),
    ).rejects.toThrow(/503/);
  });

  it('rejects malformed job data', async () => {
    const fetchFn = vi.fn();
    await expect(
      createMilestoneProcessor(
        cfg,
        fetchFn as unknown as typeof fetch,
      )(job({ kind: 'drop-tables', milestoneId: 'x' })),
    ).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
