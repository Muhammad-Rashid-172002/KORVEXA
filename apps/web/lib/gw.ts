import { API_URL } from './config';

export interface GwResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/** Small JSON helper for the API routes that aren't in the generated OpenAPI client (cookie auth, credentials included). */
export async function gw<T>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<GwResult<T>> {
  try {
    const res = await fetch(`${API_URL}/v1${path}`, {
      method,
      credentials: 'include',
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = (json as { error?: { message?: string } } | null)?.error?.message;
      return {
        ok: false,
        status: res.status,
        data: null,
        error: message ?? `Request failed (${res.status})`,
      };
    }
    return { ok: true, status: res.status, data: json as T, error: null };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Network error. Is the API running?' };
  }
}

/** Presigned upload → PUT to storage → complete. Returns the new file id. */
export async function uploadFile(file: File, purpose: 'avatar' | 'portfolio'): Promise<string> {
  const presign = await gw<{
    file: { id: string };
    upload: { url: string; headers: Record<string, string> };
  }>('POST', '/files/uploads', {
    purpose,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });
  if (!presign.data) throw new Error(presign.error ?? 'Upload rejected');
  const put = await fetch(presign.data.upload.url, {
    method: 'PUT',
    headers: presign.data.upload.headers,
    body: file,
  });
  if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);
  const done = await gw('POST', `/files/${presign.data.file.id}/complete`);
  if (!done.ok) throw new Error(done.error ?? 'Upload verification failed');
  return presign.data.file.id;
}

/** Fresh key for one user intent (order, funding, payout). Reuse it on retries so the server can deduplicate. */
export const newIdempotencyKey = () => `web-${crypto.randomUUID()}`;
