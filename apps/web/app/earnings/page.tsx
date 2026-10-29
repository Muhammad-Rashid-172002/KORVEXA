import type { EarningsView } from '@glasswork/shared';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { PayoutForm } from './payout-form';

export const metadata: Metadata = { title: 'Earnings' };
export const dynamic = 'force-dynamic';

export default async function EarningsPage() {
  const res = await serverGw<EarningsView>('/me/earnings');
  if (res.status === 401) redirect('/login?next=/earnings');
  if (!res.data) redirect('/settings'); // not a seller
  const e = res.data;
  const stat = (label: string, value: number, testId: string) => (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-semibold tabular-nums" data-testid={testId}>
        {money(value, e.currency)}
      </span>
    </Card>
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Earnings</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {stat('Available', e.available, 'available')}
        {stat('In milestones (held)', e.inEscrow, 'in-escrow')}
        {stat('Payout requested', e.pendingPayout, 'pending-payout')}
        {stat('Paid out', e.paidOut, 'paid-out')}
      </div>

      <Card className="flex flex-col gap-3">
        <CardTitle>Request a payout</CardTitle>
        <PayoutForm available={e.available} min={e.minPayout} />
        <ul className="flex flex-col gap-1 text-xs text-muted">
          {e.payoutRails.map((r) => (
            <li key={r.rail}>
              <strong>{r.rail.replace(/_/g, ' ')}</strong>: {r.available ? 'available' : 'not available'}.{' '}
              {r.note}
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="tr" className="flex flex-col gap-2">
        <h2 id="tr" className="text-lg font-semibold">
          Released milestones
        </h2>
        {e.transfers.length === 0 ? (
          <p className="text-sm text-muted">Nothing released yet.</p>
        ) : (
          <ul
            className="flex flex-col divide-y divide-border rounded-md border border-border text-sm"
            data-testid="transfers"
          >
            {e.transfers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {t.project} · {t.milestone}
                </span>
                <span className="tabular-nums">
                  {money(t.net, e.currency)}
                  <span className="text-xs text-muted"> (fee {money(t.fee, e.currency)})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="po" className="flex flex-col gap-2">
        <h2 id="po" className="text-lg font-semibold">
          Payouts
        </h2>
        {e.payouts.length === 0 ? (
          <p className="text-sm text-muted">
            No payouts yet. After a buyer approves a step, the money shows up here and you can ask to be paid
            out.
          </p>
        ) : (
          <ul
            className="flex flex-col divide-y divide-border rounded-md border border-border text-sm"
            data-testid="payouts"
          >
            {e.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                  {p.providerRef && <span className="text-xs text-muted"> · ref {p.providerRef}</span>}
                </span>
                <span className="tabular-nums">{money(p.amount, e.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
