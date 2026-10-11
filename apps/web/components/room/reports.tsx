'use client';
import type { ProgressReportView, ReportContent } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState } from 'react';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

const SECTIONS = [
  ['done', 'Done'],
  ['next', 'Up next'],
  ['risks', 'Risks'],
  ['decisionsNeeded', 'Decisions needed from you'],
] as const;
type ListKey = (typeof SECTIONS)[number][0];

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

function ReportBody({ c }: { c: ReportContent }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p data-testid="report-summary">{c.summary}</p>
      {SECTIONS.map(([k, label]) =>
        c[k].length ? (
          <div key={k}>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted">{label}</h4>
            <ul className="list-disc pl-5">
              {c[k].map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

function Draft({
  r,
  reload,
  setMsg,
}: {
  r: ProgressReportView;
  reload: () => Promise<void>;
  setMsg: (m: string | null) => void;
}) {
  const [summary, setSummary] = useState(r.content.summary);
  const [lists, setLists] = useState<Record<ListKey, string>>({
    done: r.content.done.join('\n'),
    next: r.content.next.join('\n'),
    risks: r.content.risks.join('\n'),
    decisionsNeeded: r.content.decisionsNeeded.join('\n'),
  });
  const [busy, setBusy] = useState(false);
  const content = (): ReportContent => ({
    summary: summary.trim(),
    done: lines(lists.done),
    next: lines(lists.next),
    risks: lines(lists.risks),
    decisionsNeeded: lines(lists.decisionsNeeded),
  });

  async function act(kind: 'save' | 'send' | 'discard') {
    setBusy(true);
    setMsg(null);
    let res;
    if (kind === 'discard') res = await gw('DELETE', `/reports/${r.id}`);
    else {
      res = await gw('PATCH', `/reports/${r.id}`, { content: content() });
      if (res.ok && kind === 'send') res = await gw('POST', `/reports/${r.id}/send`);
    }
    setBusy(false);
    if (!res.ok) setMsg(res.error);
    await reload();
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="report-draft">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>
          Draft · {new Date(r.periodStart).toLocaleDateString()} to{' '}
          {new Date(r.periodEnd).toLocaleDateString()}
        </CardTitle>
        <Badge data-testid="report-origin">
          {r.generatedBy === 'ai' ? 'AI draft' : 'Drafted from project data'}
        </Badge>
        {r.edited && <Badge>Edited</Badge>}
        <Badge data-testid="report-status">Not sent</Badge>
      </div>
      <p className="text-xs text-muted">
        Only you can see this draft. Check every line, fix what is wrong, then send it to your client.
      </p>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Summary
        <textarea
          aria-label="Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          maxLength={1500}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-muted">
            {label} (one per line)
            <textarea
              aria-label={label}
              value={lists[k]}
              onChange={(e) => setLists((l) => ({ ...l, [k]: e.target.value }))}
              rows={4}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void act('send')}>
          Send to client
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act('save')}>
          Save changes
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act('discard')}>
          Discard draft
        </Button>
      </div>
    </Card>
  );
}

export function Reports({ projectId, isSeller }: { projectId: string; isSeller: boolean }) {
  const { data, reload } = useLoad<ProgressReportView[]>(`/projects/${projectId}/reports`);
  const [msg, setMsg] = useState<string | null>(null);
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setMsg(null);
    const r = await gw('POST', `/projects/${projectId}/reports/generate`, { days: Number(days) });
    setBusy(false);
    if (!r.ok) setMsg(r.error);
    await reload();
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const drafts = data.filter((r) => r.status === 'draft');
  const sent = data.filter((r) => r.status === 'sent');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {isSeller
          ? 'Progress reports are written from this project’s real activity. Weekly drafts appear automatically; you can also write one any time. Nothing reaches your client until you send it.'
          : 'Reports your seller has reviewed and sent appear here.'}
      </p>
      {msg && <Alert tone="danger">{msg}</Alert>}
      {isSeller && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Period
            <select
              aria-label="Report period"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <Button disabled={busy} onClick={() => void generate()}>
            {busy ? 'Writing…' : 'Write a report'}
          </Button>
        </div>
      )}
      {isSeller &&
        drafts.map((r) => <Draft key={`${r.id}-${r.createdAt}`} r={r} reload={reload} setMsg={setMsg} />)}
      <ul className="flex flex-col gap-3" data-testid="reports-list">
        {sent.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-3" data-testid="report">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {new Date(r.periodStart).toLocaleDateString()} to{' '}
                  {new Date(r.periodEnd).toLocaleDateString()}
                </CardTitle>
                <Badge data-testid="report-status">
                  Sent {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : ''}
                </Badge>
                {r.edited && <Badge>Edited by seller</Badge>}
              </div>
              <ReportBody c={r.content} />
            </Card>
          </li>
        ))}
      </ul>
      {sent.length === 0 && <p className="text-sm text-muted">No reports have been sent yet.</p>}
    </div>
  );
}
