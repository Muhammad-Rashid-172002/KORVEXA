'use client';
import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type NotificationView,
  type ServerToClientEvents,
} from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';
import { gw } from '@/lib/gw';

/** Header bell: live unread count (socket) + the latest notifications. Rendered only for signed-in users. */
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([
      gw<{ unread: number }>('GET', '/me/notifications/unread-count'),
      gw<{ items: NotificationView[] }>('GET', '/me/notifications?limit=8'),
    ]);
    if (c.data) setUnread(c.data.unread);
    if (l.data) setItems(l.data.items);
  }, []);

  useEffect(() => {
    void load();
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
    });
    socket.on('notification:new', (n) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 8));
      void gw<{ unread: number }>('GET', '/me/notifications/unread-count').then(
        (r) => r.data && setUnread(r.data.unread),
      );
    });
    return () => {
      socket.close();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openItem(n: NotificationView) {
    setOpen(false);
    if (!n.readAt) {
      await gw('POST', '/me/notifications/read', { ids: [n.id] });
      void load();
    }
    if (n.url) router.push(n.url);
  }

  return (
    <div className="relative" ref={box}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        data-testid="bell"
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span
            className="min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-on-primary"
            data-testid="bell-count"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          data-testid="bell-panel"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
            <strong>Notifications</strong>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={async () => {
                await gw('POST', '/me/notifications/read', {});
                void load();
              }}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(n)}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-2 ${n.readAt ? 'text-muted' : ''}`}
                    data-testid="bell-item"
                  >
                    <span className="font-medium">{n.title}</span>
                    {n.body && <span className="line-clamp-2 text-xs text-muted">{n.body}</span>}
                    <span className="text-[11px] text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs text-primary hover:bg-surface-2"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
