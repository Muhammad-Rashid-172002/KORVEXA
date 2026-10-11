import type { Job } from 'bullmq';

interface Config {
  API_INTERNAL_URL: string;
  INTERNAL_API_TOKEN: string;
}

/**
 * Weekly schedule tick. The API decides which projects need a draft (active, moved this week, none in the last
 * 6 days) and never sends anything: the seller reviews and sends. Non-2xx throws so BullMQ retries with backoff.
 */
export function createReportsProcessor(cfg: Config, fetchFn: typeof fetch = fetch) {
  return async (_job: Job): Promise<unknown> => {
    const res = await fetchFn(`${cfg.API_INTERNAL_URL}/v1/internal/reports/weekly`, {
      method: 'POST',
      headers: { 'x-internal-token': cfg.INTERNAL_API_TOKEN },
    });
    if (!res.ok) throw new Error(`API responded ${res.status} for the weekly reports run`);
    return res.json();
  };
}
