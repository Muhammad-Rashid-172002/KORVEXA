/* eslint-disable @next/next/no-img-element -- presigned storage URLs */
import type { ServiceCardView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { EmptyState } from '@glasswork/ui/components/empty-state';
import { PackagePlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ServiceCover } from '@/components/service-cover';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { ServiceActions } from './service-actions';

export const metadata: Metadata = { title: 'My services' };
export const dynamic = 'force-dynamic';

const STATUS_HELP: Record<string, string> = {
  draft: 'Not online yet. Submit it when you are ready.',
  pending_review: 'Our team is checking it. This usually takes about a day.',
  live: 'Online. Buyers can find and order it.',
  rejected: 'Needs a change before it can go online.',
  paused: 'Hidden from buyers until you resume it.',
};

export default async function MyServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const res = await serverGw<ServiceCardView[]>('/me/services');
  if (res.status === 401) redirect('/login?next=/sell/services');
  if (!res.data) redirect('/settings'); // not a seller yet
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My services</h1>
        <Button asChild>
          <Link href="/sell/services/new">Create a service</Link>
        </Button>
      </div>
      {submitted && (
        <Alert tone="success">
          Thank you! Your service was sent to our team. We will check it and let you know, usually within a
          day.
        </Alert>
      )}
      {res.data.length === 0 ? (
        <EmptyState
          icon={<PackagePlus aria-hidden />}
          title="Create your first service"
          description="A service is what you sell, for example “I will build your online shop”. It takes about 10 minutes, and we guide you through every step."
          action={
            <Button asChild>
              <Link href="/sell/services/new">Create a service</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="my-services">
          {res.data.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-col gap-3 sm:flex-row">
                <div className="w-full shrink-0 overflow-hidden rounded-lg sm:w-44">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <ServiceCover
                      category={s.category.slug}
                      seed={s.slug}
                      title={s.title}
                      seller={s.seller.displayName}
                      className="aspect-video w-full"
                    />
                  )}
                  {!s.imageUrl && (
                    <p className="mt-1 text-[11px] text-warning" data-testid="autogen-note">
                      Auto-generated cover. Edit and upload your own image.
                    </p>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
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
                  <p className="text-xs text-muted">{STATUS_HELP[s.status]}</p>
                  <ServiceActions id={s.id} status={s.status} slug={s.slug} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
