import { z } from 'zod';

/** BullMQ queue names shared by api (producer) and worker (consumer). */
export const QUEUES = { email: 'email', milestones: 'milestones', scan: 'scan', reports: 'reports' } as const;

/** Weekly progress-report drafts: Mondays 07:00 UTC. */
export const WEEKLY_REPORTS_CRON = '0 7 * * 1';

/** Virus-scan job: the worker streams the object to ClamAV and reports back to the API. */
export const scanJobSchema = z.object({ fileId: z.uuid(), storageKey: z.string().min(1) });
export type ScanJob = z.infer<typeof scanJobSchema>;
export const scanResultSchema = z.object({
  status: z.enum(['clean', 'infected']),
  signature: z.string().max(200).optional(),
});

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
  z.object({
    template: z.literal('notification'),
    to: z.email(),
    data: z.object({ name: z.string(), title: z.string(), body: z.string().nullable(), url: z.url() }),
  }),
]);
export type EmailJob = z.infer<typeof emailJobSchema>;
