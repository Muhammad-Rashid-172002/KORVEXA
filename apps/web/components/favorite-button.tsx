'use client';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { gw } from '@/lib/gw';

const cache: { ids: Set<string> | null; promise: Promise<Set<string> | null> | null } = {
  ids: null,
  promise: null,
};

/** One shared fetch of the viewer's favorite ids; null = signed out. */
function loadIds(force = false): Promise<Set<string> | null> {
  if (force || !cache.promise) {
    cache.promise = gw<string[]>('GET', '/me/favorites/ids').then((r) => {
      cache.ids = r.data ? new Set(r.data) : null;
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
