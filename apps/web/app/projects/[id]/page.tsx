import type { ProjectView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { ProjectMoney } from './project-money';

export const metadata: Metadata = { title: 'Project' };
export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<ProjectView>(`/projects/${id}`);
  if (res.status === 401) redirect(`/login?next=/projects/${id}`);
  if (!res.data) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <ProjectMoney project={res.data} />
    </div>
  );
}
