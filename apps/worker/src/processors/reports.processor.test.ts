import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { createReportsProcessor } from './reports.processor';

const cfg = { API_INTERNAL_URL: 'http://api:4000', INTERNAL_API_TOKEN: 'secret-token-0123456789abcd' };

describe('reports processor', () => {
  it('calls the internal weekly route with the shared token', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ drafted: 2, skipped: 1 }), { status: 200 })),
    );
    const out = await createReportsProcessor(cfg, fetchFn as unknown as typeof fetch)({} as Job);
    expect(out).toEqual({ drafted: 2, skipped: 1 });
    expect(fetchFn).toHaveBeenCalledWith('http://api:4000/v1/internal/reports/weekly', {
      method: 'POST',
      headers: { 'x-internal-token': cfg.INTERNAL_API_TOKEN },
    });
  });
  it('throws on a non-2xx so BullMQ retries', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('no', { status: 500 })));
    await expect(createReportsProcessor(cfg, fetchFn as unknown as typeof fetch)({} as Job)).rejects.toThrow(
      /500/,
    );
  });
});
