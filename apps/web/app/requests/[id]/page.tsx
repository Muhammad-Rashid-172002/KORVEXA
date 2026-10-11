import type { BriefView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { RequestDetail } from './request-detail';

export const metadata: Metadata = { title: 'Request' };
export const dynamic = 'force-dynamic';

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<BriefView>(`/briefs/${id}`);
  if (res.status === 401) redirect(`/login?next=/requests/${id}`);
  if (!res.data) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <RequestDetail brief={res.data} />
    </div>
  );
}
