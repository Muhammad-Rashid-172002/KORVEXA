import type { NotificationView } from '@glasswork/shared';
import { Card } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { MarkAllRead } from './mark-all-read';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const res = await serverGw<{ items: NotificationView[] }>('/me/notifications?limit=50');
  if (res.status === 401 || !res.data) redirect('/login?next=/notifications');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-primary underline-offset-4 hover:underline" href="/settings/notifications">
            Preferences
          </Link>
          <MarkAllRead />
        </div>
      </div>
      {res.data.items.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing yet. Updates about your projects, messages and payments will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="notification-list">
          {res.data.items.map((n) => (
            <li key={n.id}>
              <Card className={`flex flex-col gap-1 py-3 ${n.readAt ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">
                    {n.url ? (
                      <Link className="hover:underline" href={n.url}>
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </span>
                  <time className="shrink-0 text-xs text-muted" dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                </div>
                {n.body && <p className="text-xs text-muted">{n.body}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
