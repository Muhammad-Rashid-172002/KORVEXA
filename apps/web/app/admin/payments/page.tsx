import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { ReplayButton } from './replay-button';

export const metadata: Metadata = { title: 'Admin · Payments' };
export const dynamic = 'force-dynamic';

interface Ledger {
  trialBalance: number;
  cash: number;
  revenue: number;
  payoutClearing: number;
  escrow: number;
  sellerPayable: number;
}
interface Event {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
}

export default async function AdminPayments() {
  const [ledger, events] = await Promise.all([
    serverGw<Ledger>('/admin/ledger/summary'),
    serverGw<Event[]>('/admin/webhook-events?failed=true'),
  ]);
  const l = ledger.data;
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <CardTitle>Ledger health</CardTitle>
        {l ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3" data-testid="ledger">
            <Stat label="Trial balance (must be 0)" value={l.trialBalance} ok={l.trialBalance === 0} />
            <Stat label="Platform cash" value={l.cash} />
            <Stat label="Held in milestones" value={l.escrow} />
            <Stat label="Owed to sellers" value={l.sellerPayable} />
            <Stat label="Payouts reserved" value={l.payoutClearing} />
            <Stat label="Platform revenue" value={l.revenue} />
          </dl>
        ) : (
          <p className="text-sm text-muted">Unavailable.</p>
        )}
      </Card>
      <section className="flex flex-col gap-3" aria-labelledby="we">
        <h2 id="we" className="text-lg font-semibold">
          Webhook events needing attention
        </h2>
        {(events.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">All received events were processed.</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="failed-events">
            {events.data!.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    {e.provider} · {e.type}
                  </p>
                  <p className="font-mono text-xs text-muted">{e.eventId}</p>
                  <p className="text-sm text-danger">{e.error ?? 'Not processed yet'}</p>
                  <ReplayButton id={e.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: number; ok?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular-nums ${ok === false ? 'text-danger' : ''}`}>{money(value)}</dd>
    </div>
  );
}
