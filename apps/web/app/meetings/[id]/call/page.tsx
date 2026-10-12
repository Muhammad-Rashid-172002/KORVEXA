import type { MeetingView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { CallPanel } from './call-panel';

export const metadata: Metadata = { title: 'Meeting' };
export const dynamic = 'force-dynamic';

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<MeetingView>(`/meetings/${id}`);
  if (res.status === 401) redirect(`/login?next=/meetings/${id}/call`);
  if (!res.data) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <CallPanel meeting={res.data} />
    </div>
  );
}
