/** Standard API error envelope (DECISIONS D-015). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const ERROR_CODES = {
  validation: 'validation_failed',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  rateLimited: 'rate_limited',
  internal: 'internal_error',
} as const;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
