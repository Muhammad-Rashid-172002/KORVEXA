import type { ProjectListItem } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const res = await serverGw<{ items: ProjectListItem[] }>('/projects?limit=50');
  if (res.status === 401) redirect('/login?next=/projects');
  const items = res.data?.items ?? [];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          No projects yet.{' '}
          <Link className="text-primary underline-offset-4 hover:underline" href="/services">
            Browse services
          </Link>{' '}
          to place an order.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="project-list">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`}>
                <Card className="flex flex-col gap-2 hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="min-w-0">{p.title}</CardTitle>
                    <Badge>{p.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {p.code} · {p.myRole === 'buyer' ? 'Seller' : 'Buyer'}: {p.counterparty} ·{' '}
                    {money(p.totalAmount, p.currency)}
                  </p>
                  <div
                    className="h-1.5 w-full rounded-full bg-surface-2"
                    role="progressbar"
                    aria-valuenow={p.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progress"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
