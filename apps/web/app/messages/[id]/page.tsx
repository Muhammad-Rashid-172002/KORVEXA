import type { MessagePageView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { serverGw } from '@/lib/server-gw';
import { Conversation } from './conversation';

export const metadata: Metadata = { title: 'Conversation' };
export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<MessagePageView>(`/conversations/${id}/messages?limit=1`);
  if (res.status === 401) redirect(`/login?next=/messages/${id}`);
  if (!res.data) notFound();
  const api = await serverApi();
  const { data: me } = await api.GET('/v1/me');
  if (!me) redirect('/login');
  const other = res.data.members.find((m) => m.userId !== me.id);
  return (
    <Conversation
      conversationId={id}
      myId={me.id}
      otherName={other?.name ?? 'Conversation'}
      canOffer={me.roles.includes('seller')}
    />
  );
}
