import 'server-only';
import { createApiClient } from '@glasswork/shared/api';
import { cookies, headers } from 'next/headers';
import { API_INTERNAL_URL } from './config';

/** Typed API client for Server Components: forwards the browser's cookies to the API. */
export async function serverApi() {
  const cookieHeader = (await cookies()).toString();
  const requestId = (await headers()).get('x-request-id') ?? undefined;
  return createApiClient(API_INTERNAL_URL, {
    headers: { cookie: cookieHeader, ...(requestId && { 'x-request-id': requestId }) },
  });
}
