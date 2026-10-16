'use client';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { gw } from '@/lib/gw';

const cache: {
  ids: Set<string> | null;
  promise: Promise<Set<string> | null> | null;
  pending: boolean;
} = {
  ids: null,
  promise: null,
  pending: false,
};

/**
 * One shared fetch of the viewer's favorite ids; null = signed out. Buttons mounting together share the in-flight
 * request (a grid of cards makes one call, not one per card); a later mount refetches so the state is never stale.
 */
function loadIds(force = false): Promise<Set<string> | null> {
  if (cache.pending && cache.promise) return cache.promise;
  if (force || !cache.promise) {
    cache.pending = true;
    cache.promise = gw<string[]>('GET', '/me/favorites/ids').then((r) => {
      cache.ids = r.data ? new Set(r.data) : null;
      cache.pending = false;
      return cache.ids;
    });
  }
  return cache.promise;
}

export function FavoriteButton({ serviceId, title }: { serviceId: string; title: string }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'out' | 'on' | 'off'>('loading');

  useEffect(() => {
    let live = true;
    void loadIds(true).then((ids) => {
      if (live) setState(ids === null ? 'out' : ids.has(serviceId) ? 'on' : 'off');
    });
    return () => {
      live = false;
    };
  }, [serviceId]);

  async function toggle() {
    if (state === 'loading') return;
    if (state === 'out') return router.push('/login?next=/services');
    const turningOn = state === 'off';
    setState(turningOn ? 'on' : 'off'); // optimistic
    const r = await gw(turningOn ? 'POST' : 'DELETE', `/services/${serviceId}/favorite`);
    if (!r.ok) setState(turningOn ? 'off' : 'on');
    else cache.ids?.[turningOn ? 'add' : 'delete'](serviceId);
  }

  return (
    <button
      type="button"
      disabled={state === 'loading'}
      onClick={() => void toggle()}
      aria-pressed={state === 'on'}
      aria-label={state === 'on' ? `Remove ${title} from favorites` : `Save ${title} to favorites`}
      className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-bg/80 text-fg backdrop-blur hover:bg-bg"
    >
      <Heart size={16} aria-hidden fill={state === 'on' ? 'currentColor' : 'none'} />
    </button>
  );
}
