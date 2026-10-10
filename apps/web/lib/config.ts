/** Browser-facing API URL (baked at build time). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** Server-side (SSR) API URL — the internal Docker service name in compose. */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? API_URL;
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
