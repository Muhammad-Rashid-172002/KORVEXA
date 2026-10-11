import './instrument';
import { createServer } from 'node:http';
import { QUEUES } from '@glasswork/shared';
import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';
import { createMailer } from './mailer';
import { createEmailProcessor } from './processors/email.processor';
import { createMilestoneProcessor } from './processors/milestone.processor';
import { createScanDeps, createScanProcessor } from './processors/scan.processor';

const connection = { url: env.REDIS_URL };
const mailer = createMailer(env);

const workers = [
  new Worker(QUEUES.email, createEmailProcessor(mailer), { connection, concurrency: 5 }),
  new Worker(QUEUES.milestones, createMilestoneProcessor(env), { connection, concurrency: 5 }),
  // The scan worker only runs when virus scanning is on (SCAN_MODE=clamav); otherwise the API marks files clean itself.
  ...(env.SCAN_MODE === 'clamav'
    ? [new Worker(QUEUES.scan, createScanProcessor(createScanDeps(env)), { connection, concurrency: 2 })]
    : []),
];

for (const w of workers) {
  w.on('completed', (job, result: unknown) =>
    logger.info({ queue: w.name, jobId: job.id, jobName: job.name, result }, 'job completed'),
  );
  w.on('failed', (job, err) => {
    logger.error(
      { queue: w.name, jobId: job?.id, jobName: job?.name, attempts: job?.attemptsMade, err },
      'job failed',
    );
    Sentry.captureException(err);
  });
  w.on('error', (err) => logger.error({ err }, 'worker error'));
}

const healthRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
healthRedis.on('error', () => undefined); // surfaced through /health instead of crashing

async function redisReachable(): Promise<boolean> {
  try {
    return (await healthRedis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

// Readiness endpoint for Docker healthchecks: workers running AND Redis reachable.
const health = createServer((_req, res) => {
  void redisReachable().then((redis) => {
    const ok = redis && workers.every((w) => w.isRunning());
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', redis, queues: workers.map((w) => w.name) }));
  });
});
health.listen(env.WORKER_HEALTH_PORT, () =>
  logger.info({ port: env.WORKER_HEALTH_PORT, mail: mailer.transport }, 'worker started'),
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  health.close();
  await Promise.allSettled([...workers.map((w) => w.close()), healthRedis.quit()]);
  await Sentry.flush(2_000);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
