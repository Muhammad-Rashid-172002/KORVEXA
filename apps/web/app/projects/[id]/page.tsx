import type { MessagePageView, ProjectView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { serverGw } from '@/lib/server-gw';
import { ProjectRoom } from './project-room';

export const metadata: Metadata = { title: 'Project' };
export const dynamic = 'force-dynamic';

export const TABS = [
  'overview',
  'timeline',
  'board',
  'deliverables',
  'previews',
  'changes',
  'disputes',
  'activity',
  'chat',
] as const;
export type Tab = (typeof TABS)[number];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; paid?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [res, chat] = await Promise.all([
    serverGw<ProjectView>(`/projects/${id}`),
    serverGw<MessagePageView>(`/projects/${id}/chat?limit=1`),
  ]);
  if (res.status === 401) redirect(`/login?next=/projects/${id}`);
  if (!res.data) notFound();
  const api = await serverApi();
  const { data: me } = await api.GET('/v1/me');
  if (!me) redirect('/login');
  const active: Tab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as Tab) : 'overview';
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <ProjectRoom
        project={res.data}
        tab={active}
        conversationId={chat.data?.conversationId ?? null}
        myId={me.id}
      />
    </div>
  );
}
