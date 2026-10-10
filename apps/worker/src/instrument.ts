import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({ dsn, environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV, tracesSampleRate: 0.1 });
}
