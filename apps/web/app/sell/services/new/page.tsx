import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { publicGw } from '@/lib/public-api';
import { serverGw } from '@/lib/server-gw';
import { ServiceForm } from '../service-form';

export const metadata: Metadata = { title: 'New service' };
export const dynamic = 'force-dynamic';

export default async function NewServicePage() {
  const mine = await serverGw('/me/services');
  if (mine.status === 401) redirect('/login?next=/sell/services/new');
  const cats = await publicGw<{ id: string; name: string }[]>('/categories');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">New service</h1>
      <ServiceForm categories={cats.data ?? []} />
    </div>
  );
}
