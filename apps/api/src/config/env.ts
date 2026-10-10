import { apiEnvSchema, parseEnv, type ApiEnv } from '@glasswork/shared/env';

export const ENV = Symbol('ENV');
export type { ApiEnv };

let cached: ApiEnv | undefined;
/** Parses and caches process env once (fail fast on boot). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  cached ??= parseEnv(apiEnvSchema, source);
  return cached;
}
export function resetEnvCache(): void {
  cached = undefined;
}

export const isOAuthEnabled = (env: ApiEnv) => ({
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
});
