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
  /** Budget for POST/PUT/PATCH/DELETE per user (or per IP when anonymous) per minute. */
  WRITE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
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
  /** Web push (VAPID). Push is disabled until both keys are set; generate with `npx web-push generate-vapid-keys`. */
  /** 'off' = uploads become downloadable immediately (dev). 'clamav' = uploads stay `uploaded` until the worker scans them. */
  SCAN_MODE: z.enum(['off', 'clamav']).default('off'),
  /** 'stub' = deterministic offline answers (dev/CI, no network); 'anthropic' = Claude API; 'off' = AI features disabled. */
  AI_PROVIDER: z.enum(['stub', 'anthropic', 'off']).default('stub'),
  ANTHROPIC_API_KEY: optional(),
  /** Default model for every AI feature. Sonnet 5.5 is plenty for extraction, summaries and ranking explanations. */
  AI_MODEL: z.string().default('claude-sonnet-5-5'),
  /** Optional per-feature overrides, e.g. AI_MODEL_BRIEF_BUILDER=claude-opus-5-5. Empty = use AI_MODEL. */
  AI_MODEL_BRIEF_BUILDER: optional(),
  AI_MODEL_MATCHING: optional(),
  AI_MODEL_PROGRESS_REPORT: optional(),
  AI_MODEL_MEETING_NOTES: optional(),
  AI_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  /** Hard spend ceilings, in US cents. Requests are refused (429) once reached; usage is measured from real token counts. */
  AI_DAILY_USER_CAP_CENTS: z.coerce.number().int().nonnegative().default(100),
  AI_DAILY_GLOBAL_CAP_CENTS: z.coerce.number().int().nonnegative().default(2000),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(30),
  /** 'stub' = no real video (join page explains), 'daily' = Daily.co rooms (unverified until keys exist), 'off' = meetings hidden. */
  VIDEO_PROVIDER: z.enum(['stub', 'daily', 'off']).default('stub'),
  DAILY_API_KEY: optional(),
  DAILY_DOMAIN: optional(),
  /** Shared secret of the GitHub App/webhook that delivers code activity. Without it the webhook route answers 503. */
  GITHUB_WEBHOOK_SECRET: optional(),
  VAPID_PUBLIC_KEY: optional(),
  VAPID_PRIVATE_KEY: optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@localhost'),
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
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY)
    ctx.addIssue({
      code: 'custom',
      path: ['ANTHROPIC_API_KEY'],
      message: 'required when AI_PROVIDER=anthropic',
    });
  if (env.VIDEO_PROVIDER === 'daily' && (!env.DAILY_API_KEY || !env.DAILY_DOMAIN))
    ctx.addIssue({
      code: 'custom',
      path: ['DAILY_API_KEY'],
      message: 'DAILY_API_KEY and DAILY_DOMAIN are required when VIDEO_PROVIDER=daily',
    });
  if (env.NODE_ENV === 'production') {
    if (env.GITHUB_WEBHOOK_SECRET?.startsWith('dev-only'))
      ctx.addIssue({
        code: 'custom',
        path: ['GITHUB_WEBHOOK_SECRET'],
        message: 'set a real GITHUB_WEBHOOK_SECRET in production',
      });
    if (env.VIDEO_PROVIDER === 'stub')
      ctx.addIssue({
        code: 'custom',
        path: ['VIDEO_PROVIDER'],
        message: 'the stub video provider cannot run in production (use daily or off)',
      });
    if (env.AI_PROVIDER === 'stub')
      ctx.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER'],
        message: 'the offline stub AI cannot run in production (use anthropic or off)',
      });
    if (!env.WEB_URL.startsWith('https://') || !env.API_PUBLIC_URL.startsWith('https://'))
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_URL'],
        message: 'WEB_URL and API_PUBLIC_URL must be https:// in production',
      });
    if (!env.TRUST_PROXY)
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message: 'TRUST_PROXY=true is required behind Caddy so rate limits see real client IPs',
      });
    if (env.API_DOCS_ENABLED)
      ctx.addIssue({
        code: 'custom',
        path: ['API_DOCS_ENABLED'],
        message: 'the API docs must be disabled in production',
      });
    if (
      env.TEST_PAYMENTS_WEBHOOK_SECRET === 'dev-only-test-payments-secret' &&
      env.PAYMENTS_PROVIDER === 'test'
    )
      ctx.addIssue({ code: 'custom', path: ['PAYMENTS_PROVIDER'], message: 'test payments are not allowed' });
    if (env.SCAN_MODE === 'off')
      ctx.addIssue({
        code: 'custom',
        path: ['SCAN_MODE'],
        message: 'uploads must be virus-scanned in production (SCAN_MODE=clamav)',
      });
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

export const workerEnvSchema = z
  .object({
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
    SCAN_MODE: z.enum(['off', 'clamav']).default('off'),
    CLAMD_HOST: z.string().default('clamav'),
    CLAMD_PORT: z.coerce.number().int().default(3310),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.RESEND_API_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'required in production (emails must not go to the local mail catcher)',
        });
      if (env.SCAN_MODE === 'off')
        ctx.addIssue({
          code: 'custom',
          path: ['SCAN_MODE'],
          message: 'uploads must be virus-scanned in production (SCAN_MODE=clamav)',
        });
      if (env.INTERNAL_API_TOKEN === 'dev-only-internal-token-change-me-0123456789')
        ctx.addIssue({
          code: 'custom',
          path: ['INTERNAL_API_TOKEN'],
          message: 'set a real INTERNAL_API_TOKEN in production',
        });
    }
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
