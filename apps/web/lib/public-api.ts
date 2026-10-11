import { API_INTERNAL_URL } from './config';

/** Server-side fetch for public (cookie-less) API routes. Never cached: responses embed expiring image URLs. */
export async function publicGw<T>(path: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${API_INTERNAL_URL}/v1${path}`, { cache: 'no-store' }).catch(() => null);
  if (!res) return { status: 0, data: null };
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}
