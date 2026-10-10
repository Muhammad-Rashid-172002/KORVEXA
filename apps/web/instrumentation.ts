// Sentry for the Next.js server runtime — disabled unless SENTRY_DSN is set (DECISIONS D-037).
export async function register() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
