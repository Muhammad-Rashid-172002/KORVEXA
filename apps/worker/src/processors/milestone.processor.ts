import { milestoneJobSchema } from '@glasswork/shared';
import type { Job } from 'bullmq';

interface Config {
  API_INTERNAL_URL: string;
  INTERNAL_API_TOKEN: string;
}

/**
 * Delayed milestone jobs (auto-approve, reminders). The worker owns the timer; the API owns the money and
 * state logic, so each job just calls the matching internal route (idempotent on the API side). Non-2xx throws
 * so BullMQ retries with backoff.
 */
export function createMilestoneProcessor(cfg: Config, fetchFn: typeof fetch = fetch) {
  return async (job: Job): Promise<unknown> => {
    const data = milestoneJobSchema.parse(job.data);
    const action = data.kind === 'auto-approve' ? 'auto-approve' : 'remind';
    const res = await fetchFn(
      `${cfg.API_INTERNAL_URL}/v1/internal/milestones/${data.milestoneId}/${action}`,
      {
        method: 'POST',
        headers: { 'x-internal-token': cfg.INTERNAL_API_TOKEN },
      },
    );
    if (!res.ok) throw new Error(`API responded ${res.status} for ${action} ${data.milestoneId}`);
    return res.json();
  };
}
