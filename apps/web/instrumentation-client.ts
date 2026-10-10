// Sentry for the browser — disabled unless NEXT_PUBLIC_SENTRY_DSN is set at build time.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1, sendDefaultPii: false });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
