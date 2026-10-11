import { SELLER_LEVELS, SERVICE_SORTS, type ServicePageView } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ServiceCard } from '@/components/service-card';
import { publicGw } from '@/lib/public-api';
import { SaveSearchButton } from './save-search-button';

export const metadata: Metadata = {
  title: 'Browse services',
  description: 'Hire builders for apps, websites, AI, SaaS and design work.',
};
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;
const SORT_LABELS: Record<(typeof SERVICE_SORTS)[number], string> = {
  relevance: 'Best match',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Top rated',
};

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const qs = new URLSearchParams();
  for (const k of [
    'q',
    'category',
    'minPrice',
    'maxPrice',
    'maxDelivery',
    'minRating',
    'level',
    'verifiedOnly',
    'sort',
    'cursor',
  ] as const) {
    const v = p[k]?.trim();
    if (v) qs.set(k, k === 'minPrice' || k === 'maxPrice' ? String(Math.round(Number(v) * 100) || '') : v);
  }
  const [res, cats] = await Promise.all([
    publicGw<ServicePageView>(`/services?${qs}`),
    publicGw<{ slug: string; name: string }[]>('/categories'),
  ]);
  const items = res.data?.items ?? [];
  const next = res.data?.nextCursor;
  const base = new URLSearchParams(
    Object.entries(p).filter(([k, v]) => v && k !== 'cursor') as [string, string][],
  );
  const saveQuery = Object.fromEntries(
    [...qs.entries()]
      .filter(([k]) => k !== 'cursor')
      .map(([k, v]) => [k, /Price|Delivery/.test(k) ? Number(v) : v]),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Browse services</h1>
        <p className="text-sm text-muted">
          Only live listings from sellers who completed onboarding appear here.
        </p>
      </div>

      <form
        action="/services"
        className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
        role="search"
      >
        <label className="flex flex-col gap-1 text-xs text-muted lg:col-span-2">
          Search
          <input
            name="q"
            defaultValue={p.q}
            placeholder="e.g. React dashboard"
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Category
          <select
            name="category"
            defaultValue={p.category ?? ''}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="">All</option>
            {cats.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Max price (USD)
          <input
            name="maxPrice"
            type="number"
            min={0}
            defaultValue={p.maxPrice}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Delivery (days)
          <input
            name="maxDelivery"
            type="number"
            min={1}
            defaultValue={p.maxDelivery}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Minimum rating
          <select
            name="minRating"
            defaultValue={p.minRating ?? ''}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="">Any</option>
            {[4.5, 4, 3].map((r) => (
              <option key={r} value={r}>
                {r}+ stars
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Seller level
          <select
            name="level"
            defaultValue={p.level ?? ''}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="">Any</option>
            {SELLER_LEVELS.filter((l) => l.key !== 'new').map((l) => (
              <option key={l.key} value={l.key}>
                {l.label} or higher
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm">
          <input
            type="checkbox"
            name="verifiedOnly"
            value="true"
            defaultChecked={p.verifiedOnly === 'true'}
          />
          Verified sellers only
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Sort
          <select
            name="sort"
            defaultValue={p.sort ?? ''}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="">Default</option>
            {SERVICE_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="ghost">
            <Link href="/services">Reset</Link>
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <SaveSearchButton query={saveQuery} />
      </div>

      <p className="text-xs text-muted">
        Ratings, levels and badges are computed from real reviews and checks.{' '}
        <Link className="text-primary underline-offset-4 hover:underline" href="/seller-levels">
          See how levels work
        </Link>
        .
      </p>

      {items.length === 0 ? (
        <p
          className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted"
          data-testid="no-results"
        >
          No services match yet. Try fewer filters{res.status === 0 ? ' (the API is unreachable)' : ''}.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="service-grid">
          {items.map((s) => (
            <li key={s.id}>
              <ServiceCard s={s} />
            </li>
          ))}
        </ul>
      )}

      {next && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={`/services?${new URLSearchParams([...base.entries(), ['cursor', next]])}`}>
            Load more
          </Link>
        </Button>
      )}
    </div>
  );
}
