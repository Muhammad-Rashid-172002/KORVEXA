import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const uploadOrigin = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN ?? 'http://localhost:9000';
const isDev = process.env.NODE_ENV !== 'production';
const wsUrl = apiUrl.replace(/^http/, 'ws');

/**
 * Content Security Policy. Next.js needs inline scripts for hydration ('unsafe-inline'); moving to
 * nonces is tracked for Phase 9 hardening. connect-src is limited to our API, its websocket and storage.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${apiUrl} ${wsUrl} ${uploadOrigin}${isDev ? ' ws://localhost:*' : ''} https://*.ingest.sentry.io https://*.ingest.de.sentry.io`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' " + apiUrl,
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@glasswork/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isDev
            ? []
            : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
        ],
      },
    ];
  },
};

export default nextConfig;
