// Local dev convenience: load the repo-root .env when running outside Docker (`pnpm dev`).
// Existing variables win, and production/Docker never ship a .env file.
import { existsSync } from 'node:fs';
import path from 'node:path';

const rootEnv = path.resolve(__dirname, '../../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
