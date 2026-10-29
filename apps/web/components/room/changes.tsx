'use client';
import type { ChangeRequestView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState, type FormEvent } from 'react';
import { money } from '@/lib/format';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

export function Changes({ projectId, editable }: { projectId: string; editable: boolean }) {
  const { data, reload } = useLoad<ChangeRequestView[]>(`/projects/${projectId}/change-requests`);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState([{ title: '', amount: '', days: '7' }]);

  async function act(id: string, action: 'accept' | 'decline' | 'withdraw') {
    const r = await gw('POST', `/projects/${projectId}/change-requests/${id}/${action}`);
    setMsg(r.ok ? null : r.error);
    await reload();
  }
  async function propose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await gw('POST', `/projects/${projectId}/change-requests`, {
      title: String(f.get('title')).trim(),
      description: String(f.get('description')).trim(),
      daysDelta: Number(f.get('daysDelta') || 0),
      milestones: rows
        .filter((x) => x.title.trim())
        .map((x) => ({
          title: x.title.trim(),
          amount: Math.round(Number(x.amount) * 100),
          days: Number(x.days),
        })),
    });
    setMsg(r.ok ? null : r.error);
    if (r.ok) {
      (e.target as HTMLFormElement).reset();
      setRows([{ title: '', amount: '', days: '7' }]);
      await reload();
    }
  }
  const set = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((a) => a.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Scope changes are agreed formally. When accepted, any new milestones are added to the plan and must be
        funded like the others.
      </p>
      {msg && <Alert tone="danger">{msg}</Alert>}
      {data.length === 0 && (
        <p className="text-sm text-muted">
          No change requests. If the plan changes, a request with the new price and time appears here for you
          to accept or decline.
        </p>
      )}
      <ul className="flex flex-col gap-3" data-testid="change-list">
        {data.map((c) => (
          <li key={c.id}>
            <Card className="flex flex-col gap-2" data-testid="change-request">
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{c.title}</CardTitle>
                <Badge data-testid="change-status">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted">Proposed by {c.requestedBy.name}</p>
              <p className="whitespace-pre-wrap text-sm">{c.description}</p>
              <p className="text-sm">
                Price impact <strong className="tabular-nums">+{money(c.priceDeltaAmount)}</strong> · Time
                impact <strong>+{c.daysDelta} days</strong>
              </p>
              {c.milestones.length > 0 && (
                <ul className="text-xs text-muted">
                  {c.milestones.map((m, i) => (
                    <li key={i}>
                      New milestone: {m.title} · {money(m.amount)} · {m.days} days
                    </li>
                  ))}
                </ul>
              )}
              {c.canRespond && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void act(c.id, 'accept')}>
                    Accept change
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void act(c.id, 'decline')}>
                    Decline
                  </Button>
                </div>
              )}
              {c.canWithdraw && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => void act(c.id, 'withdraw')}
                >
                  Withdraw
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {editable && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Propose a scope change</CardTitle>
          <form onSubmit={propose} className="flex flex-col gap-3" data-testid="change-form">
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              aria-label="Change title"
              placeholder="Title"
              className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
            />
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={3000}
              rows={3}
              aria-label="Change description"
              placeholder="What changes and why?"
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              Add days to open milestones
              <input
                name="daysDelta"
                type="number"
                min={0}
                max={90}
                defaultValue={0}
                className="h-9 w-20 rounded-md border border-border bg-bg px-2 text-sm text-fg"
              />
            </label>
            {rows.map((r, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_6rem]">
                <input
                  aria-label={`New milestone ${i + 1} title`}
                  placeholder="New milestone (optional)"
                  value={r.title}
                  onChange={(e) => set(i, { title: e.target.value })}
                  className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
                />
                <input
                  aria-label={`New milestone ${i + 1} price (USD)`}
                  type="number"
                  min={5}
                  step="0.01"
                  placeholder="Price USD"
                  value={r.amount}
                  onChange={(e) => set(i, { amount: e.target.value })}
                  className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
                />
                <input
                  aria-label={`New milestone ${i + 1} days`}
                  type="number"
                  min={1}
                  max={180}
                  value={r.days}
                  onChange={(e) => set(i, { days: e.target.value })}
                  className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setRows((a) => [...a, { title: '', amount: '', days: '7' }])}
            >
              Add another milestone
            </Button>
            <Button type="submit" className="self-start">
              Send proposal
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
