'use client';
import type { MilestoneView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState } from 'react';
import { gw } from '@/lib/gw';

interface Suggestion {
  title: string;
  description: string;
  keep: boolean;
}

/** Seller-only: paste notes, review the suggested tasks, add the ones you want. Nothing is saved until you confirm. */
export function MeetingNotes({ projectId, milestones }: { projectId: string; milestones: MilestoneView[] }) {
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [milestoneId, setMilestoneId] = useState('');
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function suggest() {
    setBusy(true);
    setMsg(null);
    const r = await gw<{ tasks: { title: string; description: string }[] }>(
      'POST',
      `/projects/${projectId}/meeting-notes`,
      { notes },
    );
    setBusy(false);
    if (!r.data) return setMsg({ tone: 'danger', text: r.error ?? 'Failed' });
    setItems(r.data.tasks.map((t) => ({ ...t, keep: true })));
    if (r.data.tasks.length === 0)
      setMsg({ tone: 'danger', text: 'No action items were found in these notes.' });
  }

  async function add() {
    const chosen = (items ?? []).filter((i) => i.keep && i.title.trim().length >= 2);
    setBusy(true);
    const r = await gw('POST', `/projects/${projectId}/meeting-notes/tasks`, {
      milestoneId: milestoneId || null,
      tasks: chosen.map((i) => ({ title: i.title.trim(), description: i.description })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: 'danger', text: r.error ?? 'Failed' });
    setMsg({
      tone: 'success',
      text: `${chosen.length} task${chosen.length === 1 ? '' : 's'} added to the board.`,
    });
    setItems(null);
    setNotes('');
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="meeting-notes">
      <CardTitle>Meeting notes to tasks</CardTitle>
      <p className="text-sm text-muted">
        Paste your notes from a call. We suggest tasks; you choose which ones go on the board.
      </p>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Meeting notes
        <textarea
          aria-label="Meeting notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={20000}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
        />
      </label>
      <Button
        className="self-start"
        size="sm"
        disabled={busy || notes.trim().length < 30}
        onClick={() => void suggest()}
      >
        {busy && !items ? 'Reading…' : 'Suggest tasks'}
      </Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {items && items.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="suggested-tasks">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Keep task ${i + 1}`}
                checked={it.keep}
                onChange={(e) =>
                  setItems((a) => a!.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))
                }
              />
              <input
                aria-label={`Task ${i + 1} title`}
                value={it.title}
                maxLength={140}
                onChange={(e) =>
                  setItems((a) => a!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg"
              />
            </div>
          ))}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Link to milestone (optional)
            <select
              aria-label="Link to milestone"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.position}. {m.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="self-start"
            size="sm"
            disabled={busy || !items.some((i) => i.keep)}
            onClick={() => void add()}
          >
            Add selected to board
          </Button>
        </div>
      )}
    </Card>
  );
}
