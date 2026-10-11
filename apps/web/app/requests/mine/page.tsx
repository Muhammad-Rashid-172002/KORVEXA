import type { BriefView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'My requests' };
export const dynamic = 'force-dynamic';

export default async function MyRequestsPage() {
  const res = await serverGw<BriefView[]>('/me/briefs');
  if (res.status === 401 || !res.data) redirect('/login?next=/requests/mine');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
      {res.data.length === 0 ? (
        <p className="text-sm text-muted">
          You have not posted a request.{' '}
          <Link className="text-primary underline-offset-4 hover:underline" href="/requests/new">
            Post one
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="my-requests">
          {res.data.map((b) => (
            <li key={b.id}>
              <Link href={`/requests/${b.id}`}>
                <Card className="flex items-center justify-between gap-3 hover:bg-surface-2">
                  <CardTitle>{b.title}</CardTitle>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {b.proposalCount} proposal{b.proposalCount === 1 ? '' : 's'}
                    <Badge>{b.status}</Badge>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
