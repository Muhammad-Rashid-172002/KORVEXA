'use client';
import type { ChatMessageView, MessagePageView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Paperclip } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { money } from '@/lib/format';
import { gw, newIdempotencyKey, uploadFile } from '@/lib/gw';
import { useRealtime } from '@/lib/realtime';

function OfferCard({ msg, myId, onChange }: { msg: ChatMessageView; myId: string; onChange: () => void }) {
  const router = useRouter();
  const o = msg.offer!;
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const iAmSeller = msg.sender.id === myId;

  async function accept() {
    const r = await gw<{ projectId: string }>('POST', `/offers/${o.id}/accept`, undefined, {
      'idempotency-key': key.current,
    });
    if (!r.data) return setError(r.error);
    router.push(`/projects/${r.data.projectId}`);
  }
  async function close(path: 'decline' | 'withdraw') {
    const r = await gw('POST', `/offers/${o.id}/${path}`);
    if (!r.ok) return setError(r.error);
    onChange();
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-surface-2 p-3 text-sm"
      data-testid="offer-card"
    >
      <div className="flex items-start justify-between gap-3">
        <strong>{o.title}</strong>
        <span className="font-semibold tabular-nums">{money(o.totalAmount, o.currency)}</span>
      </div>
      <p className="whitespace-pre-wrap text-muted">{o.description}</p>
      <ol className="text-xs text-muted">
        {o.milestonePlan.map((m, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {i + 1}. {m.title} · {m.days} days
            </span>
            <span className="tabular-nums">{money(m.amount, o.currency)}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs" data-testid="offer-status">
        Status: {o.status}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      {o.status === 'sent' && !iAmSeller && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void accept()}>
            Accept offer
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void close('decline')}>
            Decline
          </Button>
        </div>
      )}
      {o.status === 'sent' && iAmSeller && (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => void close('withdraw')}>
          Withdraw offer
        </Button>
      )}
      {o.status === 'accepted' && o.projectId && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => router.push(`/projects/${o.projectId}`)}
        >
          Open project
        </Button>
      )}
    </div>
  );
}

export function ChatPanel({ conversationId, myId }: { conversationId: string; myId: string }) {
  const { socket, online } = useRealtime();
  const [items, setItems] = useState<ChatMessageView[]>([]);
  const [members, setMembers] = useState<MessagePageView['members']>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const lastRead = useRef<string | null>(null);

  const load = useCallback(async () => {
    const r = await gw<MessagePageView>('GET', `/conversations/${conversationId}/messages?limit=50`);
    if (r.data) {
      setItems(r.data.items);
      setMembers(r.data.members);
      setCursor(r.data.nextCursor);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(
    (messageId: string) => {
      if (lastRead.current && lastRead.current >= messageId) return;
      lastRead.current = messageId;
      socket?.emit('chat:read', { conversationId, messageId });
    },
    [socket, conversationId],
  );

  // Realtime: new messages, typing, read receipts.
  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessageView) => {
      if (m.conversationId !== conversationId) return;
      setItems((prev) =>
        prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m],
      );
      if (m.sender.id !== myId) markRead(m.id);
      // Offer status changes arrive as a system message; refresh to update the offer card.
      if (m.kind === 'system') void load();
    };
    const onTyping = (p: { conversationId: string; userId: string; typing: boolean }) => {
      if (p.conversationId !== conversationId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (p.typing) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    };
    const onRead = (p: { conversationId: string; userId: string; lastReadMessageId: string }) => {
      if (p.conversationId !== conversationId) return;
      setMembers((prev) =>
        prev.map((m) => (m.userId === p.userId ? { ...m, lastReadMessageId: p.lastReadMessageId } : m)),
      );
    };
    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:read', onRead);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:read', onRead);
    };
  }, [socket, conversationId, myId, markRead, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    const lastFromOther = [...items].reverse().find((m) => m.sender.id !== myId);
    if (lastFromOther) markRead(lastFromOther.id);
  }, [items, myId, markRead]);

  function onType() {
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      socket?.emit('chat:typing', { conversationId, typing: true });
      lastTypingSent.current = now;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit('chat:typing', { conversationId, typing: false });
      lastTypingSent.current = 0;
    }, 2000);
  }

  async function onFile(file: File) {
    try {
      const id = await uploadFile(file, 'message');
      setFiles((f) => [...f, { id, name: file.name }].slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function onSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body && files.length === 0) return;
    setBusy(true);
    setError(null);
    const r = await gw<ChatMessageView>('POST', `/conversations/${conversationId}/messages`, {
      body,
      fileIds: files.map((f) => f.id),
    });
    setBusy(false);
    if (!r.data)
      return setError(r.status === 429 ? 'You are sending messages too quickly. Wait a moment.' : r.error);
    form.reset();
    setFiles([]);
    socket?.emit('chat:typing', { conversationId, typing: false });
    setItems((prev) => (prev.some((x) => x.id === r.data!.id) ? prev : [...prev, r.data!]));
  }

  async function openAttachment(id: string) {
    const r = await gw<{ url: string }>('GET', `/files/${id}/download`);
    if (r.data) window.open(r.data.url, '_blank', 'noopener,noreferrer');
    else setError(r.error ?? 'File not available');
  }

  const other = members.find((m) => m.userId !== myId);
  const otherOnline = other ? online.has(other.userId) : false;
  const myLast = [...items].reverse().find((m) => m.sender.id === myId);
  const seen = Boolean(myLast && other?.lastReadMessageId && other.lastReadMessageId >= myLast.id);
  const someoneTyping = [...typingUsers].some((id) => id !== myId);

  return (
    <div
      className="flex h-[32rem] flex-col rounded-xl border border-border bg-surface"
      data-testid="chat-panel"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-2 rounded-full ${otherOnline ? 'bg-success' : 'bg-muted'}`}
            data-testid="presence-dot"
            data-online={otherOnline}
          />
          {other?.name ?? 'Chat'}
          <span className="text-xs text-muted">{otherOnline ? 'online' : 'offline'}</span>
        </span>
      </div>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
        data-testid="chat-messages"
        aria-live="polite"
      >
        {cursor && (
          <Button
            size="sm"
            variant="ghost"
            className="self-center"
            onClick={async () => {
              const r = await gw<MessagePageView>(
                'GET',
                `/conversations/${conversationId}/messages?limit=50&cursor=${cursor}`,
              );
              if (r.data) {
                setItems((prev) => [...r.data!.items, ...prev]);
                setCursor(r.data.nextCursor);
              }
            }}
          >
            Load earlier messages
          </Button>
        )}
        {items.length === 0 && <p className="m-auto text-sm text-muted">No messages yet. Say hello.</p>}
        {items.map((m) => {
          const mine = m.sender.id === myId;
          if (m.kind === 'system') {
            return (
              <p key={m.id} className="self-center text-xs text-muted">
                {m.body}
              </p>
            );
          }
          return (
            <div
              key={m.id}
              className={`flex max-w-[85%] flex-col gap-1 ${mine ? 'items-end self-end' : 'items-start self-start'}`}
              data-testid="chat-message"
            >
              <span className="text-xs text-muted">
                {mine ? 'You' : m.sender.name} ·{' '}
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {m.kind === 'custom_offer' && m.offer ? (
                <OfferCard msg={m} myId={myId} onChange={() => void load()} />
              ) : (
                <>
                  {m.body && (
                    <p
                      className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-on-primary' : 'bg-surface-2'}`}
                    >
                      {m.body}
                    </p>
                  )}
                  {m.attachments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void openAttachment(a.id)}
                      className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs hover:bg-surface"
                    >
                      <Paperclip size={12} aria-hidden /> {a.name}
                    </button>
                  ))}
                </>
              )}
              {mine && myLast?.id === m.id && (
                <span className="text-xs text-muted" data-testid="seen-indicator" data-seen={seen}>
                  {seen ? 'Seen' : 'Sent'}
                </span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="h-5 px-4 text-xs text-muted" data-testid="typing-indicator" aria-live="polite">
        {someoneTyping ? `${other?.name ?? 'Someone'} is typing…` : ''}
      </div>
      {error && (
        <div className="px-4 pb-2">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border p-3">
        <label className="cursor-pointer rounded-md p-2 hover:bg-surface-2" aria-label="Attach a file">
          <Paperclip size={16} aria-hidden />
          <input
            type="file"
            className="sr-only"
            data-testid="chat-file-input"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,application/zip"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
        </label>
        {files.map((f) => (
          <span
            key={f.id}
            className="rounded-md bg-surface-2 px-2 py-1 text-xs"
            data-testid="pending-attachment"
          >
            {f.name}
          </span>
        ))}
        <input
          name="body"
          data-testid="chat-input"
          aria-label="Message"
          autoComplete="off"
          maxLength={4000}
          placeholder="Write a message…"
          onChange={onType}
          className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
        <Button type="submit" disabled={busy} data-testid="chat-send">
          Send
        </Button>
      </form>
    </div>
  );
}
