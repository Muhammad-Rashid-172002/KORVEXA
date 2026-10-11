import { z } from 'zod';

/** BullMQ queue names shared by api (producer) and worker (consumer). */
export const QUEUES = { email: 'email', milestones: 'milestones' } as const;

/** Delayed jobs that call back into the API, which owns all money/state logic. */
export const milestoneJobSchema = z.object({
  kind: z.enum(['auto-approve', 'reminder']),
  milestoneId: z.uuid(),
});
export type MilestoneJob = z.infer<typeof milestoneJobSchema>;

export const emailJobSchema = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('verify-email'),
    to: z.email(),
    data: z.object({ name: z.string(), url: z.url() }),
  }),
  z.object({
    template: z.literal('reset-password'),
    to: z.email(),
    data: z.object({ name: z.string(), url: z.url() }),
  }),
  z.object({
    template: z.literal('org-invite'),
    to: z.email(),
    data: z.object({ inviterName: z.string(), orgName: z.string(), url: z.url() }),
  }),
  z.object({
    template: z.literal('milestone-reminder'),
    to: z.email(),
    data: z.object({
      name: z.string(),
      projectTitle: z.string(),
      milestoneTitle: z.string(),
      daysLeft: z.number().int(),
      url: z.url(),
    }),
  }),
]);
export type EmailJob = z.infer<typeof emailJobSchema>;
