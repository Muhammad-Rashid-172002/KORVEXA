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

export const apiEnvSchema = z.object({
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
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z.object({
  ...base,
  WORKER_HEALTH_PORT: z.coerce.number().int().default(4001),
  REDIS_URL: z.string().min(1),
  EMAIL_FROM: z.string().default('no-reply@localhost'),
  SMTP_HOST: optional(),
  SMTP_PORT: z.coerce.number().int().default(1025),
  RESEND_API_KEY: optional(),
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
