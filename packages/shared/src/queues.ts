import { z } from 'zod';

/** BullMQ queue names shared by api (producer) and worker (consumer). */
export const QUEUES = { email: 'email' } as const;

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
]);
export type EmailJob = z.infer<typeof emailJobSchema>;
