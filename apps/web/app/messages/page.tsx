import type { ConversationView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const res = await serverGw<ConversationView[]>('/me/conversations');
  if (res.status === 401 || !res.data) redirect('/login?next=/messages');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      {res.data.length === 0 ? (
        <p className="text-sm text-muted">
          No conversations yet. Use “Message seller” on a service, or open a project’s Chat tab.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="conversation-list">
          {res.data.map((c) => (
            <li key={c.id}>
              <Link href={c.projectId ? `/projects/${c.projectId}?tab=chat` : `/messages/${c.id}`}>
                <Card className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      {c.title}
                      {c.kind === 'project' && <Badge>project</Badge>}
                    </CardTitle>
                    <p className="truncate text-xs text-muted">{c.lastMessage?.body ?? 'No messages yet'}</p>
                  </div>
                  {c.unread > 0 && <Badge className="border-primary/50 text-primary">{c.unread}</Badge>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
