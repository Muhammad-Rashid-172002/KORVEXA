import type { SellerAnalyticsView } from '@glasswork/shared';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Seller analytics' };
export const dynamic = 'force-dynamic';

const pct = (n: number | null) => (n === null ? null : `${Math.round(n * 100)}%`);

function Stat({
  label,
  value,
  note,
  id,
}: {
  label: string;
  value: string | null;
  note?: string;
  id: string;
}) {
  return (
    <Card className="flex flex-col gap-1" data-testid={`stat-${id}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" data-testid={`stat-${id}-value`}>
        {value ?? 'Not enough data yet'}
      </p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </Card>
  );
}

export default async function AnalyticsPage() {
  const res = await serverGw<SellerAnalyticsView>('/me/analytics');
  if (res.status === 401) redirect('/login?next=/seller/analytics');
  if (!res.data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">
        Analytics are for sellers.{' '}
        <Link className="text-primary underline-offset-4 hover:underline" href="/seller/onboarding">
          Set up your seller profile
        </Link>
        .
      </div>
    );
  const a = res.data;
  const hrs = (h: number | null) => (h === null ? null : h < 1 ? 'Under 1 hour' : `${h} hours`);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your analytics</h1>
        <p className="text-sm text-muted">
          Computed from your real orders, proposals and chats. Nothing is estimated; a metric shows “not
          enough data yet” until there is something to measure.
        </p>
      </div>
      {!a.hasData && (
        <p
          className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted"
          data-testid="analytics-empty"
        >
          No activity yet. Publish a service, answer messages and send proposals to see your numbers here.
        </p>
      )}
      <section aria-label="Earnings" className="grid gap-4 sm:grid-cols-3">
        <Stat
          id="earnings-total"
          label="Earned (after commission)"
          value={a.earnings.total > 0 ? money(a.earnings.total, a.currency) : null}
        />
        <Stat
          id="earnings-30"
          label="Last 30 days"
          value={a.earnings.last30Days > 0 ? money(a.earnings.last30Days, a.currency) : null}
        />
        <Stat
          id="escrow"
          label="Held in escrow for you"
          value={a.earnings.pendingInEscrow > 0 ? money(a.earnings.pendingInEscrow, a.currency) : null}
          note="Paid out when the buyer approves."
        />
      </section>
      <section aria-label="Performance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          id="conversion"
          label="Proposal conversion"
          value={pct(a.proposals.conversionRate)}
          note={`${a.proposals.accepted} accepted of ${a.proposals.sent} sent`}
        />
        <Stat
          id="response"
          label="Median first reply"
          value={hrs(a.responseHours.median)}
          note={`Based on ${a.responseHours.sampleSize} conversation${a.responseHours.sampleSize === 1 ? '' : 's'} in the last 90 days`}
        />
        <Stat
          id="ontime"
          label="On-time delivery"
          value={pct(a.onTime.rate)}
          note="Milestones submitted by the planned date"
        />
        <Stat
          id="repeat"
          label="Repeat buyers"
          value={pct(a.repeatBuyers.rate)}
          note={`${a.repeatBuyers.repeat} of ${a.repeatBuyers.buyers} buyers hired you again`}
        />
        <Stat
          id="completed"
          label="Completed projects"
          value={a.completedProjects > 0 ? String(a.completedProjects) : null}
        />
        <Stat
          id="rating"
          label="Average rating"
          value={a.rating.average === null ? null : `${a.rating.average.toFixed(1)} (${a.rating.count})`}
        />
      </section>
      <CardTitle className="sr-only">About these numbers</CardTitle>
      <p className="text-xs text-muted">
        Demo and seed data is never counted. See how your numbers feed your{' '}
        <Link className="text-primary underline-offset-4 hover:underline" href="/seller/verification">
          seller level
        </Link>
        .
      </p>
    </div>
  );
}
