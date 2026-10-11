import type { SavedSearchView, ServiceCardView } from '@glasswork/shared';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ServiceCard } from '@/components/service-card';
import { serverGw } from '@/lib/server-gw';
import { DeleteSavedSearch } from './delete-saved-search';

export const metadata: Metadata = { title: 'Favorites' };
export const dynamic = 'force-dynamic';

const toHref = (q: SavedSearchView['query']) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, /Price/.test(k) ? String(Number(v) / 100) : String(v));
  }
  return `/services?${p}`;
};

export default async function FavoritesPage() {
  const [favs, searches] = await Promise.all([
    serverGw<ServiceCardView[]>('/me/favorites'),
    serverGw<SavedSearchView[]>('/me/saved-searches'),
  ]);
  if (favs.status === 401 || !favs.data) redirect('/login?next=/favorites');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
      <section aria-labelledby="fs" className="flex flex-col gap-3">
        <h2 id="fs" className="text-lg font-semibold">
          Saved services
        </h2>
        {favs.data.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing saved yet.{' '}
            <Link className="text-primary underline-offset-4 hover:underline" href="/services">
              Browse services
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="favorites-grid">
            {favs.data.map((s) => (
              <li key={s.id}>
                <ServiceCard s={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="ss" className="flex flex-col gap-3">
        <h2 id="ss" className="text-lg font-semibold">
          Saved searches
        </h2>
        {(searches.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Save a search from the browse page to get back to it quickly.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="saved-searches">
            {searches.data!.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between gap-3 py-3">
                  <CardTitle>
                    <Link className="hover:underline" href={toHref(s.query)}>
                      {s.name}
                    </Link>
                  </CardTitle>
                  <DeleteSavedSearch id={s.id} name={s.name} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
