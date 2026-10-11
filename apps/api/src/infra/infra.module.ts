import { createDb, type DbClient } from '@glasswork/db';
import { QUEUES, type EmailJob, type MilestoneJob, type ScanJob } from '@glasswork/shared';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, loadEnv, type ApiEnv } from '../config/env';
import { DB, EMAIL_QUEUE, MILESTONE_QUEUE, REDIS, SCAN_QUEUE } from './tokens';

export type EmailQueue = Queue<EmailJob>;
export type MilestoneQueue = Queue<MilestoneJob>;
export type ScanQueue = Queue<ScanJob>;

/** Process-wide infrastructure clients: env, Postgres pool, Redis, BullMQ producers. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: DB, inject: [ENV], useFactory: (env: ApiEnv): DbClient => createDb(env.DATABASE_URL) },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: EMAIL_QUEUE,
      inject: [ENV],
      useFactory: (env: ApiEnv): EmailQueue =>
        new Queue<EmailJob>(QUEUES.email, {
          connection: { url: env.REDIS_URL },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        }),
    },
    {
      provide: MILESTONE_QUEUE,
      inject: [ENV],
      useFactory: (env: ApiEnv): MilestoneQueue =>
        new Queue<MilestoneJob>(QUEUES.milestones, {
          connection: { url: env.REDIS_URL },
          defaultJobOptions: {
            attempts: 8,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        }),
    },
    {
      provide: SCAN_QUEUE,
      inject: [ENV],
      useFactory: (env: ApiEnv): ScanQueue =>
        new Queue<ScanJob>(QUEUES.scan, {
          connection: { url: env.REDIS_URL },
          defaultJobOptions: {
            attempts: 6,
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        }),
    },
  ],
  exports: [ENV, DB, REDIS, EMAIL_QUEUE, MILESTONE_QUEUE, SCAN_QUEUE],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: EmailQueue,
    @Inject(MILESTONE_QUEUE) private readonly milestoneQueue: MilestoneQueue,
    @Inject(SCAN_QUEUE) private readonly scanQueue: ScanQueue,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.emailQueue.close(),
      this.milestoneQueue.close(),
      this.scanQueue.close(),
      this.redis.quit(),
      this.db.pool.end(),
    ]);
  }
}
