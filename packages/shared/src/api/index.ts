import createClient, { type Client } from 'openapi-fetch';
import type { paths } from './schema';

export type { paths } from './schema';
export type ApiClient = Client<paths>;

/** Typed REST client generated from the API's OpenAPI spec (`pnpm openapi`). */
export function createApiClient(
  baseUrl: string,
  init?: { fetch?: typeof fetch; headers?: Record<string, string> },
): ApiClient {
  return createClient<paths>({ baseUrl, credentials: 'include', ...init });
}
