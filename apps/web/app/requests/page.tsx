import type { BriefView } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Requests' };
export const dynamic = 'force-dynamic';

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const res = await serverGw<{ items: BriefView[] }>(
    `/briefs?limit=30${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );
  if (res.status === 401) redirect('/login?next=/requests');
  const isSeller = res.status === 200;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Buyer requests</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/requests/mine">My requests</Link>
          </Button>
          <Button asChild>
            <Link href="/requests/new">Post a request</Link>
          </Button>
        </div>
      </div>
      {!isSeller ? (
        <p className="text-sm text-muted">
          Sellers with a published profile can browse open requests and send proposals. You can still post
          your own request and receive proposals.
        </p>
      ) : (
        <>
          <form action="/requests" role="search" className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              aria-label="Search requests"
              placeholder="Search requests"
              className="h-10 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          {res.data!.items.length === 0 ? (
            <p className="text-sm text-muted">No open requests match.</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="request-board">
              {res.data!.items.map((b) => (
                <li key={b.id}>
                  <Link href={`/requests/${b.id}`}>
                    <Card className="flex flex-col gap-2 hover:bg-surface-2">
                      <CardTitle>{b.title}</CardTitle>
                      <p className="line-clamp-2 text-sm text-muted">{b.description}</p>
                      <p className="text-xs text-muted">
                        {b.budgetMinAmount !== null || b.budgetMaxAmount !== null
                          ? `Budget ${b.budgetMinAmount !== null ? money(b.budgetMinAmount, b.currency) : '…'} – ${b.budgetMaxAmount !== null ? money(b.budgetMaxAmount, b.currency) : '…'}`
                          : 'No budget given'}
                        {' · '}
                        {b.proposalCount} proposal{b.proposalCount === 1 ? '' : 's'} · by {b.buyer.name}
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
