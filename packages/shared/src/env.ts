import { z } from 'zod';

/**
 * Environment schemas, validated at process start (fail fast). Every variable is documented in .env.example.
 * Empty strings are treated as "unset" so `FOO=` in .env behaves like a missing optional key.
 */
const optional = () =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const base = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: optional(),
  SENTRY_ENVIRONMENT: optional(),
};

const apiEnvObject = z.object({
  ...base,
  API_PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  WEB_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: optional(),
  /** Parent domain for cross-subdomain auth cookies in prod, e.g. `.glasswork.app`. Empty in dev. */
  COOKIE_DOMAIN: optional(),
  /** Set true behind a reverse proxy (Caddy) so client IPs come from X-Forwarded-For. */
  TRUST_PROXY: bool(false),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  AUTH_RATE_LIMIT_ENABLED: bool(true),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  GOOGLE_CLIENT_ID: optional(),
  GOOGLE_CLIENT_SECRET: optional(),
  GITHUB_CLIENT_ID: optional(),
  GITHUB_CLIENT_SECRET: optional(),
  S3_ENDPOINT: z.url(),
  S3_PUBLIC_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool(true),
  S3_AUTO_CREATE_BUCKET: bool(false),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  API_DOCS_ENABLED: bool(false),
  /** 'test' = built-in simulated provider (local dev/CI, no network); 'stripe' = Stripe (test keys until Q1 is answered). */
  PAYMENTS_PROVIDER: z.enum(['test', 'stripe']).default('test'),
  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: optional(),
  /** Must stay false until the legal entity is decided (D-020); live keys are refused otherwise. */
  PAYMENTS_LIVE_ENABLED: bool(false),
  /** HMAC secret for the built-in test provider's signed webhooks. */
  TEST_PAYMENTS_WEBHOOK_SECRET: z.string().min(16).default('dev-only-test-payments-secret'),
  /** Shared secret the worker uses to call internal API routes (auto-approve timers). */
  INTERNAL_API_TOKEN: z.string().min(24).default('dev-only-internal-token-change-me-0123456789'),
});
export const apiEnvSchema = apiEnvObject.superRefine((env, ctx) => {
  const key = env.STRIPE_SECRET_KEY;
  if (env.PAYMENTS_PROVIDER === 'stripe') {
    if (!key)
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'required when PAYMENTS_PROVIDER=stripe',
      });
    if (!env.STRIPE_WEBHOOK_SECRET)
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_WEBHOOK_SECRET'],
        message: 'required when PAYMENTS_PROVIDER=stripe',
      });
  }
  if (key?.startsWith('sk_live_') && !env.PAYMENTS_LIVE_ENABLED) {
    ctx.addIssue({
      code: 'custom',
      path: ['STRIPE_SECRET_KEY'],
      message: 'live Stripe keys are refused until PAYMENTS_LIVE_ENABLED=true (DECISIONS D-020)',
    });
  }
  if (env.NODE_ENV === 'production') {
    if (env.PAYMENTS_PROVIDER === 'test')
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENTS_PROVIDER'],
        message: 'the simulated test provider cannot run in production',
      });
    if (env.INTERNAL_API_TOKEN.startsWith('dev-only'))
      ctx.addIssue({
        code: 'custom',
        path: ['INTERNAL_API_TOKEN'],
        message: 'set a real INTERNAL_API_TOKEN in production',
      });
  }
});
export type ApiEnv = z.infer<typeof apiEnvObject>;

export const workerEnvSchema = z.object({
  ...base,
  WORKER_HEALTH_PORT: z.coerce.number().int().default(4001),
  REDIS_URL: z.string().min(1),
  EMAIL_FROM: z.string().default('no-reply@localhost'),
  SMTP_HOST: optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  RESEND_API_KEY: optional(),
  /** Where the worker calls internal API routes (auto-approve timers). */
  API_INTERNAL_URL: z.url().default('http://localhost:4000'),
  INTERNAL_API_TOKEN: z.string().min(24).default('dev-only-internal-token-change-me-0123456789'),
});
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example and SETUP.md.`);
  }
  return result.data;
}
