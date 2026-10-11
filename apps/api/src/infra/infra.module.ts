import { createDb, type DbClient } from '@glasswork/db';
import { QUEUES, type EmailJob } from '@glasswork/shared';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, loadEnv, type ApiEnv } from '../config/env';
import { DB, EMAIL_QUEUE, REDIS } from './tokens';

export type EmailQueue = Queue<EmailJob>;

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
  ],
  exports: [ENV, DB, REDIS, EMAIL_QUEUE],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: EmailQueue,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.emailQueue.close(), this.redis.quit(), this.db.pool.end()]);
  }
}
