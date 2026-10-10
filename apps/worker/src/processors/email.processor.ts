import { renderEmail } from '@glasswork/emails';
import { emailJobSchema } from '@glasswork/shared';
import type { Job } from 'bullmq';
import type { Mailer } from '../mailer';

/** Validates, renders and sends one email job. Throws to let BullMQ retry with backoff. */
export function createEmailProcessor(mailer: Mailer) {
  return async (job: Job): Promise<{ id: string }> => {
    const data = emailJobSchema.parse(job.data);
    const mail = await renderEmail(data);
    return mailer.send(data.to, mail);
  };
}
