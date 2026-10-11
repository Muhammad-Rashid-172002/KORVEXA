import type { DisputeView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';
import { ResolveForm } from './resolve-form';

export const metadata: Metadata = { title: 'Admin · Dispute' };
export const dynamic = 'force-dynamic';

interface CaseFile {
  generatedAt: string;
  project: { code: string; title: string; status: string; buyer?: string; seller?: string };
  milestone: {
    title: string;
    amount: number;
    status: string;
    plannedDue: string | null;
    submittedAt: string | null;
    submissionNote: string | null;
    revisionNote: string | null;
    revisionCount: number;
    acceptanceCriteria: string | null;
  };
  deliverables: {
    version: number;
    status: string;
    note: string | null;
    file: string | null;
    feedbackCount: number;
    at: string;
  }[];
  messages: { at: string; from: string; kind: string; body: string }[];
  timeline: { at: string; type: string }[];
  changeRequests: { title: string; status: string; price: number; days: number }[];
}

export default async function AdminDispute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverGw<DisputeView>(`/admin/disputes/${id}`);
  if (!res.data) notFound();
  const d = res.data;
  const c = d.caseFile as unknown as CaseFile;
  return (
    <div className="flex flex-col gap-4" data-testid="dispute-case">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {d.projectCode} · {d.milestoneTitle}
        </h2>
        <Badge>{d.status.replace('_', ' ')}</Badge>
        <span className="text-sm text-muted">
          {money(d.milestoneAmount, d.currency)} held · buyer {c.project.buyer} · seller {c.project.seller}
        </span>
      </div>
      <Card className="flex flex-col gap-2">
        <CardTitle>Reason (opened by {d.openedBy.name})</CardTitle>
        <p className="whitespace-pre-wrap text-sm">{d.reason}</p>
      </Card>

      {d.status !== 'resolved' ? (
        <ResolveForm id={d.id} amount={d.milestoneAmount} currency={d.currency} status={d.status} />
      ) : (
        <Card>
          <CardTitle>Resolved: {d.outcome}</CardTitle>
          <p className="text-sm text-muted">{d.resolutionNote}</p>
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <CardTitle>Milestone</CardTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Acceptance criteria</dt>
            <dd>{c.milestone.acceptanceCriteria ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Planned due / submitted</dt>
            <dd>
              {c.milestone.plannedDue ?? '—'} /{' '}
              {c.milestone.submittedAt ? new Date(c.milestone.submittedAt).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Seller note</dt>
            <dd>{c.milestone.submissionNote ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Buyer revision note · rounds</dt>
            <dd>
              {c.milestone.revisionNote ?? '—'} · {c.milestone.revisionCount}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-2" data-testid="case-deliverables">
        <CardTitle>Deliverables ({c.deliverables.length})</CardTitle>
        {c.deliverables.length === 0 && <p className="text-sm text-muted">None uploaded.</p>}
        <ul className="text-sm">
          {c.deliverables.map((x) => (
            <li key={x.version}>
              v{x.version} · {x.file} · {x.status} · {x.feedbackCount} feedback ·{' '}
              {new Date(x.at).toLocaleString()}
              {x.note && ` · ${x.note}`}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2" data-testid="case-evidence">
        <CardTitle>Evidence submitted by the parties ({d.evidence.length})</CardTitle>
        {d.evidence.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {d.evidence.map((e) => (
            <li key={e.id}>
              <strong>{e.by.name}</strong>: {e.note}{' '}
              {e.file && <span className="text-muted">[{e.file.name}]</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2" data-testid="case-messages">
        <CardTitle>Project chat (last {c.messages.length})</CardTitle>
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
          {c.messages.map((m, i) => (
            <li key={i}>
              <span className="text-xs text-muted">{new Date(m.at).toLocaleString()}</span>{' '}
              <strong>{m.from}</strong>: {m.body}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2" data-testid="case-timeline">
        <CardTitle>Timeline</CardTitle>
        <ol className="max-h-72 overflow-y-auto text-xs text-muted">
          {c.timeline.map((t, i) => (
            <li key={i}>
              {new Date(t.at).toLocaleString()} · {t.type}
            </li>
          ))}
        </ol>
        {c.changeRequests.length > 0 && (
          <p className="text-xs text-muted">
            Change requests: {c.changeRequests.map((x) => `${x.title} (${x.status})`).join(', ')}
          </p>
        )}
      </Card>
    </div>
  );
}
