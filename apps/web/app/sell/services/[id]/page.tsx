import type { ServiceDetailView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { publicGw } from '@/lib/public-api';
import { serverGw } from '@/lib/server-gw';
import { GigWizard, type Category } from '../gig-wizard';

export const metadata: Metadata = { title: 'Edit service' };
export const dynamic = 'force-dynamic';

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, me, cats] = await Promise.all([
    serverGw<ServiceDetailView>(`/me/services/${id}`),
    serverGw<{ displayName?: string }>('/me/profile'),
    publicGw<Category[]>('/categories'),
  ]);
  if (s.status === 401) redirect('/login');
  if (!s.data) notFound();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit your service</h1>
      <GigWizard categories={cats.data ?? []} service={s.data} sellerName={me.data?.displayName ?? 'You'} />
    </div>
  );
}
