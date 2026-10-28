import { Card } from '@glasswork/ui/components/card';
import { AlertTriangle, BadgeCheck, Flag, Gavel, Hammer, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { serverGw } from '@/lib/server-gw';

type Queue = { href: string; title: string; hint: string; icon: typeof Gavel; count: number | null };

const countOf = async (path: string): Promise<number | null> => {
  const res = await serverGw<unknown[] | { items: unknown[] }>(path);
  if (!res.data) return null;
  return Array.isArray(res.data) ? res.data.length : res.data.items.length;
};

/** Operations overview: what needs a human right now. Counts are live queue sizes, never estimates. */
export default async function AdminOverview() {
  const [disputes, verifications, reports, moderation] = await Promise.all([
    countOf('/admin/disputes?status=open'),
    countOf('/admin/verifications?status=pending'),
    countOf('/admin/reports?status=open'),
    countOf('/admin/services?status=pending_review&limit=50'),
  ]);
  const queues: Queue[] = [
    {
      href: '/admin/disputes',
      title: 'Open disputes',
      hint: 'Frozen milestones waiting for a decision',
      icon: Gavel,
      count: disputes,
    },
    {
      href: '/admin/verifications',
      title: 'Verification queue',
      hint: 'Identity and badge requests',
      icon: BadgeCheck,
      count: verifications,
    },
    {
      href: '/admin/reports',
      title: 'Open reports',
      hint: 'Safety and content reports',
      icon: Flag,
      count: reports,
    },
    {
      href: '/admin/services',
      title: 'Listings to moderate',
      hint: 'New services awaiting approval',
      icon: Hammer,
      count: moderation,
    },
  ];
  const tools = [
    { href: '/admin/users', title: 'Users', icon: Users },
    { href: '/admin/payments', title: 'Payments and webhooks', icon: Wallet },
    { href: '/admin/payouts', title: 'Payouts', icon: Wallet },
    { href: '/admin/settings', title: 'Fees and timers', icon: AlertTriangle },
  ];
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="queues" className="flex flex-col gap-3">
        <h2 id="queues" className="text-lg font-semibold">
          Needs attention
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((q) => (
            <li key={q.href}>
              <Link href={q.href} className="no-underline block h-full">
                <Card className="card-lift flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <q.icon size={18} className="text-primary" aria-hidden />
                    <span className="text-2xl font-semibold tabular-nums" data-testid={`queue-${q.title}`}>
                      {q.count ?? '–'}
                    </span>
                  </div>
                  <p className="font-medium">{q.title}</p>
                  <p className="text-xs text-muted">{q.hint}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="tools" className="flex flex-col gap-3">
        <h2 id="tools" className="text-lg font-semibold">
          Tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="no-underline block">
                <Card className="card-lift flex items-center gap-3 p-4">
                  <t.icon size={18} className="text-primary" aria-hidden />
                  <span className="font-medium">{t.title}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Every action here is recorded in the <Link href="/admin/audit">audit log</Link>.
        </p>
      </section>
    </div>
  );
}
