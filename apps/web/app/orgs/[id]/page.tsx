import type { OrgView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { OrgManager } from './org-manager';

export const metadata: Metadata = { title: 'Organization' };
export const dynamic = 'force-dynamic';

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await serverGw<OrgView>(`/orgs/${id}`);
  if (org.status === 401) redirect('/login');
  if (!org.data) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <OrgManager org={org.data} />
    </div>
  );
}
