import 'server-only';
import { cookies } from 'next/headers';
import { API_INTERNAL_URL } from './config';

/** Server-component fetch to the API, forwarding the browser's cookies. Returns null on 401/404/errors. */
export async function serverGw<T>(path: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${API_INTERNAL_URL}/v1${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return { status: 0, data: null };
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}
