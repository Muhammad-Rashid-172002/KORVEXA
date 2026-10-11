'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState, type FormEvent } from 'react';
import { ChatPanel } from '@/components/room/chat-panel';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { money } from '@/lib/format';
import { gw } from '@/lib/gw';
import { RealtimeProvider } from '@/lib/realtime';

type Row = { title: string; amount: string; days: string };

function OfferForm({ conversationId, onDone }: { conversationId: string; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([
    { title: 'Prototype', amount: '', days: '7' },
    { title: 'Launch', amount: '', days: '14' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const set = (i: number, patch: Partial<Row>) =>
    setRows((a) => a.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    const r = await gw('POST', `/conversations/${conversationId}/offers`, {
      title: String(f.get('title')).trim(),
      description: String(f.get('description')).trim(),
      milestonePlan: rows.map((x) => ({
        title: x.title.trim(),
        amount: Math.round(Number(x.amount) * 100),
        days: Number(x.days),
      })),
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="offer-form">
      <Field id="title" label="Offer title" required minLength={3} maxLength={120} />
      <TextareaField
        id="description"
        label="What is included"
        rows={3}
        required
        minLength={10}
        maxLength={3000}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Milestones</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
            <Field
              id={`o-title-${i}`}
              label="Milestone"
              value={r.title}
              onChange={(e) => set(i, { title: e.target.value })}
              required
            />
            <Field
              id={`o-amount-${i}`}
              label="Price (USD)"
              type="number"
              min={5}
              step="0.01"
              value={r.amount}
              onChange={(e) => set(i, { amount: e.target.value })}
              required
            />
            <Field
              id={`o-days-${i}`}
              label="Days"
              type="number"
              min={1}
              max={180}
              value={r.days}
              onChange={(e) => set(i, { days: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              disabled={rows.length === 1}
              onClick={() => setRows((a) => a.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {rows.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setRows((a) => [...a, { title: '', amount: '', days: '7' }])}
          >
            Add milestone
          </Button>
        )}
      </fieldset>
      <p className="text-sm">
        Total: <strong className="tabular-nums">{money(Math.round(total * 100))}</strong>
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Sending…' : 'Send offer'}
      </Button>
    </form>
  );
}

export function Conversation({
  conversationId,
  myId,
  otherName,
  canOffer,
}: {
  conversationId: string;
  myId: string;
  otherName: string;
  canOffer: boolean;
}) {
  const [showOffer, setShowOffer] = useState(false);
  return (
    <RealtimeProvider join={[{ conversationId }]}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{otherName}</h1>
          {canOffer && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowOffer((v) => !v)}
              aria-expanded={showOffer}
            >
              {showOffer ? 'Close offer form' : 'Send a custom offer'}
            </Button>
          )}
        </div>
        {showOffer && (
          <Card className="flex flex-col gap-3">
            <CardTitle>Custom offer</CardTitle>
            <OfferForm conversationId={conversationId} onDone={() => setShowOffer(false)} />
          </Card>
        )}
        <ChatPanel conversationId={conversationId} myId={myId} />
      </div>
    </RealtimeProvider>
  );
}
