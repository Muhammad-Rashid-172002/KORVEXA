'use client';
import { useCallback, useEffect, useState } from 'react';
import { gw } from './gw';
import { useRealtime } from './realtime';

/** Fetches an API route and refetches it whenever the room reports a change (realtime tick) or `reload()` is called. */
export function useLoad<T>(path: string | null) {
  const { tick } = useRealtime();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!path) return;
    const r = await gw<T>('GET', path);
    if (r.data) setData(r.data);
    setError(r.error);
    setLoading(false);
  }, [path]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  return { data, error, loading, reload: load, setData };
}
