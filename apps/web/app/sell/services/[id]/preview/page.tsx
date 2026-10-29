import type { ServiceDetailView } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ServicePreview } from '@/components/service-preview';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Preview your service', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Owner-only preview: works for drafts and gigs under review, which have no public page yet. */
export default async function PreviewMyService({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<ServiceDetailView>(`/me/services/${id}`);
  if (res.status === 401) redirect(`/login?next=/sell/services/${id}/preview`);
  if (!res.data) notFound();
  const s = res.data;
  return (
    <ServicePreview
      s={s}
      banner="This is how buyers will see your service."
      actions={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/sell/services">Back to my services</Link>
          </Button>
          {s.status !== 'pending_review' && (
            <Button asChild size="sm">
              <Link href={`/sell/services/${s.id}`}>Edit</Link>
            </Button>
          )}
          {s.status === 'live' && (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/services/${s.slug}`}>Public page</Link>
            </Button>
          )}
        </div>
      }
    />
  );
}
