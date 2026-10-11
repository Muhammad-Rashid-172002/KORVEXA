import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { PayoutActions } from './payout-actions';

export const metadata: Metadata = { title: 'Admin · Payouts' };

interface Payout {
  id: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  currency: string;
  status: string;
  rail: string;
  providerRef: string | null;
  createdAt: string;
}

export default async function AdminPayouts() {
  const res = await serverGw<Payout[]>('/admin/payouts');
  const rows = res.data ?? [];
  const open = rows.filter((p) => p.status === 'requested' || p.status === 'processing');
  const done = rows.filter((p) => !open.includes(p));
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="open">
        <h2 id="open" className="text-lg font-semibold">
          Waiting for payment ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No payouts are waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="open-payouts">
            {open.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{money(p.amount, p.currency)}</CardTitle>
                    <Badge>{p.rail.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Seller {p.sellerName} ({p.sellerId.slice(-6)}) · requested{' '}
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                  <PayoutActions id={p.id} amount={money(p.amount, p.currency)} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="done">
        <h2 id="done" className="text-lg font-semibold">
          History
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm">
          {done.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 px-3 py-2">
              <span>
                {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                {p.providerRef && <span className="text-xs text-muted"> · ref {p.providerRef}</span>}
              </span>
              <span className="tabular-nums">{money(p.amount, p.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
