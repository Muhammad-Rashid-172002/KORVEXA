import './instrument';
import { createServer } from 'node:http';
import { QUEUES } from '@glasswork/shared';
import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';
import { env } from './env';
import { logger } from './logger';
import { createMailer } from './mailer';
import { createEmailProcessor } from './processors/email.processor';

const connection = { url: env.REDIS_URL };
const mailer = createMailer(env);

const workers = [
  new Worker(QUEUES.email, createEmailProcessor(mailer), { connection, concurrency: 5 }),
];

for (const w of workers) {
  w.on('completed', (job, result: { id: string }) =>
    logger.info({ queue: w.name, jobId: job.id, jobName: job.name, messageId: result.id }, 'job completed'),
  );
  w.on('failed', (job, err) => {
    logger.error({ queue: w.name, jobId: job?.id, jobName: job?.name, attempts: job?.attemptsMade, err }, 'job failed');
    Sentry.captureException(err);
  });
  w.on('error', (err) => logger.error({ err }, 'worker error'));
}

// Liveness/readiness endpoint for Docker healthchecks.
const health = createServer((req, res) => {
  const ok = workers.every((w) => w.isRunning());
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', queues: workers.map((w) => w.name) }));
});
health.listen(env.WORKER_HEALTH_PORT, () =>
  logger.info({ port: env.WORKER_HEALTH_PORT, mail: mailer.transport }, 'worker started'),
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  health.close();
  await Promise.allSettled(workers.map((w) => w.close()));
  await Sentry.flush(2_000);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
