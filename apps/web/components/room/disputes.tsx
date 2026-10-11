'use client';
import type { DisputeView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState, type FormEvent } from 'react';
import { money } from '@/lib/format';
import { gw, uploadFile } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

function Evidence({ d, onChange }: { d: DisputeView; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get('file') as File | null;
    try {
      let fileId: string | undefined;
      if (file && file.size) fileId = await uploadFile(file, 'evidence');
      const note = String(f.get('note') ?? '').trim();
      const r = await gw('POST', `/disputes/${d.id}/evidence`, {
        kind: fileId ? 'upload' : 'note',
        note: note || undefined,
        fileId,
      });
      if (!r.ok) throw new Error(r.error ?? 'Could not add evidence');
      form.reset();
      setError(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function open(id: string) {
    const r = await gw<{ url: string }>('GET', `/files/${id}/download`);
    if (r.data) window.open(r.data.url, '_blank', 'noopener,noreferrer');
  }
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h4 className="text-sm font-medium">Evidence</h4>
      {d.evidence.length === 0 && (
        <p className="text-xs text-muted">
          Nothing added yet. The case file (messages, deliverables, timeline) was collected automatically.
        </p>
      )}
      <ul className="flex flex-col gap-1 text-sm" data-testid="evidence-list">
        {d.evidence.map((e) => (
          <li key={e.id}>
            <strong>{e.by.name}</strong>: {e.note}
            {e.file && (
              <button
                type="button"
                className="ml-2 text-primary hover:underline"
                onClick={() => void open(e.file!.id)}
              >
                {e.file.name}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <Alert tone="danger">{error}</Alert>}
      {d.status !== 'resolved' && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2" data-testid="evidence-form">
          <input
            name="note"
            maxLength={3000}
            aria-label="Evidence note"
            placeholder="Add a note"
            className="h-9 min-w-48 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
          />
          <input
            name="file"
            type="file"
            aria-label="Evidence file"
            accept="image/png,image/jpeg,application/pdf,video/mp4,text/plain"
            data-testid="evidence-file"
          />
          <Button size="sm" type="submit">
            Add evidence
          </Button>
        </form>
      )}
    </div>
  );
}

export function Disputes({ projectId }: { projectId: string }) {
  const { data, reload } = useLoad<DisputeView[]>(`/projects/${projectId}/disputes`);
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  if (data.length === 0)
    return (
      <p className="text-sm text-muted">
        No disputes. If something goes wrong with a milestone, either party can open one from the Overview
        tab; an administrator then decides with the full record.
      </p>
    );
  return (
    <ul className="flex flex-col gap-4" data-testid="dispute-list">
      {data.map((d) => (
        <li key={d.id}>
          <Card className="flex flex-col gap-3" data-testid="dispute">
            <div className="flex items-start justify-between gap-3">
              <CardTitle>
                {d.milestoneTitle} · {money(d.milestoneAmount, d.currency)}
              </CardTitle>
              <Badge data-testid="dispute-status">{d.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-muted">
              Opened by {d.openedBy.name} on {new Date(d.createdAt).toLocaleString()}
            </p>
            <p className="whitespace-pre-wrap text-sm">{d.reason}</p>
            {d.status === 'resolved' && (
              <Alert tone="info">
                <strong>Resolved: {d.outcome}</strong>
                {d.outcome === 'split' &&
                  d.refundAmount !== null &&
                  ` (${money(d.refundAmount, d.currency)} returned to the buyer)`}
                <br />
                {d.resolutionNote}
              </Alert>
            )}
            {d.status !== 'resolved' && (
              <p className="text-xs text-muted">
                Funds stay held while an administrator reviews the case. Add anything that helps below.
              </p>
            )}
            <Evidence d={d} onChange={() => void reload()} />
          </Card>
        </li>
      ))}
    </ul>
  );
}
