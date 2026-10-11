import type { ServiceCardView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { ServiceActions } from './service-actions';

export const metadata: Metadata = { title: 'My services' };
export const dynamic = 'force-dynamic';

export default async function MyServicesPage() {
  const res = await serverGw<ServiceCardView[]>('/me/services');
  if (res.status === 401) redirect('/login?next=/sell/services');
  if (!res.data) redirect('/settings'); // not a seller yet
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My services</h1>
        <Button asChild>
          <Link href="/sell/services/new">New service</Link>
        </Button>
      </div>
      {res.data.length === 0 ? (
        <p className="text-sm text-muted">You have no services yet. Create one, then submit it for review.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="my-services">
          {res.data.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="min-w-0">
                    <Link className="hover:underline" href={`/sell/services/${s.id}`}>
                      {s.title}
                    </Link>
                  </CardTitle>
                  <Badge data-testid="service-status">{s.status.replace('_', ' ')}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {s.category.name} · from {money(s.fromPrice, s.currency)}
                </p>
                <ServiceActions id={s.id} status={s.status} slug={s.slug} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
