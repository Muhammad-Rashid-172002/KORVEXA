import type { ServiceDetailView } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ServicePreview } from '@/components/service-preview';
import { serverGw } from '@/lib/server-gw';
import { ModerationActions } from '../moderation-actions';

export const metadata: Metadata = { title: 'Admin · Review a gig', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<ServiceDetailView>(`/admin/services/${id}`);
  if (!res.data) notFound();
  const s = res.data;
  return (
    <>
      <ServicePreview
        s={s}
        banner={`Reviewing a gig by ${s.seller.displayName}.`}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/services">Back to the queue</Link>
          </Button>
        }
      />
      {s.status === 'pending_review' && (
        <div className="mx-auto max-w-4xl px-4 pb-10">
          <ModerationActions id={s.id} title={s.title} />
        </div>
      )}
    </>
  );
}
