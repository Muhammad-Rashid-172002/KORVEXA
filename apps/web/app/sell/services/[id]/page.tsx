import type { ServiceDetailView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { publicGw } from '@/lib/public-api';
import { serverGw } from '@/lib/server-gw';
import { ServiceForm } from '../service-form';

export const metadata: Metadata = { title: 'Edit service' };
export const dynamic = 'force-dynamic';

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await serverGw<ServiceDetailView>(`/me/services/${id}`);
  if (s.status === 401) redirect('/login');
  if (!s.data) notFound();
  const cats = await publicGw<{ id: string; name: string }[]>('/categories');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Edit service</h1>
      <ServiceForm categories={cats.data ?? []} service={s.data} />
    </div>
  );
}
