import type { ServiceCardView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import Link from 'next/link';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { ModerationActions } from './moderation-actions';

export const metadata: Metadata = { title: 'Admin · Service moderation' };

export default async function AdminServices() {
  const res = await serverGw<{ items: ServiceCardView[] }>('/admin/services?status=pending_review&limit=50');
  const items = res.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Awaiting review ({items.length})</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">The queue is empty.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="moderation-queue">
          {items.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>
                    <Link className="hover:underline" href={`/admin/services/${s.id}`}>
                      {s.title}
                    </Link>
                  </CardTitle>
                  <Badge>{s.category.name}</Badge>
                </div>
                <p className="text-xs text-muted">
                  by {s.seller.displayName} · from {money(s.fromPrice, s.currency)}
                </p>
                <Link
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  href={`/admin/services/${s.id}`}
                >
                  View the full gig
                </Link>
                <ModerationActions id={s.id} title={s.title} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
