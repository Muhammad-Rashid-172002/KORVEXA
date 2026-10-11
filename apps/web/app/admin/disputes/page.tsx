import type { DisputeView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Admin · Disputes' };
export const dynamic = 'force-dynamic';

type Row = Omit<DisputeView, 'caseFile' | 'evidence'>;

export default async function AdminDisputes() {
  const [open, done] = await Promise.all([
    serverGw<Row[]>('/admin/disputes?status=open'),
    serverGw<Row[]>('/admin/disputes?status=resolved'),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="od">
        <h2 id="od" className="text-lg font-semibold">
          Open disputes ({open.data?.length ?? 0})
        </h2>
        {(open.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No open disputes.</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="dispute-queue">
            {open.data!.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/disputes/${d.id}`}>
                  <Card className="flex flex-col gap-1 hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>
                        {d.projectCode} · {d.milestoneTitle}
                      </CardTitle>
                      <Badge>{d.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {money(d.milestoneAmount, d.currency)} · opened by {d.openedBy.name} ·{' '}
                      {new Date(d.createdAt).toLocaleString()}
                    </p>
                    <p className="line-clamp-2 text-sm">{d.reason}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="rd">
        <h2 id="rd" className="text-lg font-semibold">
          Resolved
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm">
          {(done.data ?? []).map((d) => (
            <li key={d.id} className="flex justify-between gap-3 px-3 py-2">
              <Link className="hover:underline" href={`/admin/disputes/${d.id}`}>
                {d.projectCode} · {d.milestoneTitle}
              </Link>
              <span className="text-muted">{d.outcome}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
