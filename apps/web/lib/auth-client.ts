'use client';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { API_URL } from './config';

/** Better Auth client — talks only to our API at /v1/auth (never to the database). */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/v1/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [twoFactorClient()],
});
