import {
  accounts,
  authTokens,
  hashPassword,
  users,
  verifyPassword,
  profiles,
  auditLogs,
  sessions,
  type DbClient,
} from '@glasswork/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, openAPI } from 'better-auth/plugins';
import type { Redis } from 'ioredis';
import { uuidv7 } from 'uuidv7';
import { isOAuthEnabled, type ApiEnv } from '../config/env';
import type { EmailQueue } from '../infra/infra.module';

export const AUTH_BASE_PATH = '/v1/auth';

/**
 * Better Auth instance (DECISIONS D-010): runs inside our API on our Postgres.
 * argon2id passwords, required email verification, optional Google/GitHub OAuth,
 * Redis-backed rate limits + session cache, bearer tokens for the future Flutter app.
 */
export function createAuth(deps: { env: ApiEnv; db: DbClient; redis: Redis; emailQueue: EmailQueue }) {
  const { env, db, redis, emailQueue } = deps;
  const oauth = isOAuthEnabled(env);
  const isProd = env.NODE_ENV === 'production';

  return betterAuth({
    appName: 'glasswork',
    baseURL: env.API_PUBLIC_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_URL, ...(env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [])],
    database: drizzleAdapter(db.db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: authTokens },
    }),
    secondaryStorage: {
      get: (key) => redis.get(`ba:${key}`),
      getAndDelete: (key) => redis.getdel(`ba:${key}`),
      increment: async (key, ttl) => {
        const k = `ba:${key}`;
        const [[, value]] = (await redis.multi().incr(k).expire(k, ttl, 'NX').exec()) as [[null, number]];
        return value;
      },
      set: async (key, value, ttl) => {
        if (ttl) await redis.set(`ba:${key}`, value, 'EX', ttl);
        else await redis.set(`ba:${key}`, value);
      },
      delete: async (key) => {
        await redis.del(`ba:${key}`);
      },
    },
    session: {
      storeSessionInDatabase: true,
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
      password: { hash: hashPassword, verify: ({ hash, password }) => verifyPassword(hash, password) },
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await emailQueue.add('reset-password', {
          template: 'reset-password',
          to: user.email,
          data: { name: user.name, url },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await emailQueue.add('verify-email', {
          template: 'verify-email',
          to: user.email,
          data: { name: user.name, url },
        });
      },
    },
    socialProviders: {
      ...(oauth.google && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          prompt: 'select_account',
        },
      }),
      ...(oauth.github && {
        github: { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! },
      }),
    },
    account: {
      encryptOAuthTokens: true,
      // Link OAuth accounts only when the provider reports the email as verified (Better Auth default check).
      accountLinking: { enabled: true },
    },
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT_ENABLED,
      storage: 'secondary-storage',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: env.AUTH_RATE_LIMIT_MAX },
        '/sign-up/email': { window: 60, max: env.AUTH_RATE_LIMIT_MAX },
        '/send-verification-email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: 'gw',
      useSecureCookies: isProd,
      database: { generateId: () => uuidv7() },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      ...(env.COOKIE_DOMAIN && { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.db
              .insert(profiles)
              .values({ userId: user.id, displayName: user.name })
              .onConflictDoNothing();
            await db.db.insert(auditLogs).values({
              actorId: user.id,
              action: 'user.created',
              entityType: 'user',
              entityId: user.id,
              after: { email: user.email },
            });
          },
        },
      },
    },
    plugins: [bearer(), ...(isProd ? [] : [openAPI({ path: '/reference' })])],
  });
}

export type Auth = ReturnType<typeof createAuth>;
