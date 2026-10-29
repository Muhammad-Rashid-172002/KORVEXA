import { Button } from '@glasswork/ui/components/button';
import { EmptyState } from '@glasswork/ui/components/empty-state';
import { FileText } from 'lucide-react';
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
        <EmptyState
          icon={<FileText aria-hidden />}
          title="You have not posted a request yet"
          description="Describe what you need and experts send you offers. Not sure how to write it? Our AI helper asks a few questions and writes the brief with you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/requests/new/ai">Write it with AI</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/requests/new">Post a request</Link>
              </Button>
            </div>
          }
        />
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
