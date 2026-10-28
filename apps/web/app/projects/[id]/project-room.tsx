'use client';
import type { ProjectView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Card } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Activity } from '@/components/room/activity';
import { Board } from '@/components/room/board';
import { Changes } from '@/components/room/changes';
import { Disputes } from '@/components/room/disputes';
import { MeetingNotes } from '@/components/room/meeting-notes';
import { CodeActivity } from '@/components/room/code-activity';
import { Meetings } from '@/components/room/meetings';
import { Reports } from '@/components/room/reports';
import { ReviewsPanel } from '@/components/room/reviews-panel';
import { ChatPanel } from '@/components/room/chat-panel';
import { Deliverables } from '@/components/room/deliverables';
import { Previews } from '@/components/room/previews';
import { Timeline } from '@/components/room/timeline';
import { money } from '@/lib/format';
import { RealtimeProvider, useRealtime } from '@/lib/realtime';
import { MilestonesPanel } from './milestones-panel';
import type { Tab } from './page';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  timeline: 'Timeline',
  board: 'Board',
  deliverables: 'Deliverables',
  previews: 'Previews',
  changes: 'Changes',
  disputes: 'Disputes',
  reports: 'Reports',
  meetings: 'Meetings',
  code: 'Code',
  activity: 'Activity',
  chat: 'Chat',
};
const HEALTH_LABEL = { on_track: 'On track', at_risk: 'At risk', blocked: 'Blocked' } as const;
const HEALTH_CLASS = {
  on_track: 'border-success/50 text-success',
  at_risk: 'border-warning/50 text-warning',
  blocked: 'border-danger/50 text-danger',
} as const;

function Inner({
  project: p,
  tab,
  conversationId,
  myId,
}: {
  project: ProjectView;
  tab: Tab;
  conversationId: string | null;
  myId: string;
}) {
  const router = useRouter();
  const { tick, connected } = useRealtime();
  const isSeller = p.myRole === 'seller';
  const editable = !['cancelled', 'completed', 'reviewed'].includes(p.status);
  const current = p.milestones.find((m) => m.id === p.currentMilestoneId);

  // Server data (progress, statuses, health) refreshes whenever the room reports a change.
  useEffect(() => {
    if (tick === 0) return;
    const t = setTimeout(() => router.refresh(), 250);
    return () => clearTimeout(t);
  }, [tick, router]);

  return (
    <>
      <div>
        <p className="text-xs text-muted">{p.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge data-testid="project-status">{p.status.replace(/_/g, ' ')}</Badge>
          <Badge className={HEALTH_CLASS[p.health]} data-testid="project-health">
            {HEALTH_LABEL[p.health]}
          </Badge>
          Buyer {p.buyer.name} · Seller{' '}
          {p.seller.slug ? (
            <Link className="text-primary underline-offset-4 hover:underline" href={`/u/${p.seller.slug}`}>
              {p.seller.name}
            </Link>
          ) : (
            p.seller.name
          )}
          <span
            className="ml-auto flex items-center gap-1 text-xs"
            data-testid="live-indicator"
            data-connected={connected}
          >
            <span aria-hidden className={`size-2 rounded-full ${connected ? 'bg-success' : 'bg-muted'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </p>
        {p.healthReason && (
          <p className="mt-1 text-sm" data-testid="health-reason">
            {p.healthReason}
          </p>
        )}
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="tabular-nums" data-testid="progress-value">
            {p.progress}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={p.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${p.progress}%` }}
          />
        </div>
        <ol className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr" aria-label="Milestone steps">
          {p.milestones.map((m) => {
            const done = ['approved', 'released'].includes(m.status);
            const active = ['in_progress', 'submitted', 'revision_requested', 'funded'].includes(m.status);
            return (
              <li
                key={m.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${done ? 'border-primary/40 bg-primary/10' : active ? 'border-primary/60' : 'border-border'}`}
              >
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${done ? 'bg-primary text-on-primary' : active ? 'border border-primary text-primary' : 'border border-border text-muted'}`}
                >
                  {done ? '✓' : m.position}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="sr-only">{done ? 'done' : active ? 'in progress' : 'not started'}</span>
                <span className="tabular-nums text-muted">{money(m.amount, p.currency)}</span>
              </li>
            );
          })}
        </ol>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Project total</dt>
            <dd className="tabular-nums">{money(p.totalAmount, p.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Held for milestones</dt>
            <dd className="tabular-nums" data-testid="escrow-held">
              {money(p.escrow.held, p.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Paid to seller</dt>
            <dd className="tabular-nums" data-testid="escrow-released">
              {money(p.escrow.released, p.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Next deadline</dt>
            <dd data-testid="next-deadline">
              {p.nextDeadline ? `${p.nextDeadline.date} · ${p.nextDeadline.title}` : '—'}
            </dd>
          </div>
        </dl>
        {current && (
          <p className="text-sm" data-testid="current-milestone">
            Current milestone:{' '}
            <strong>
              {current.position}. {current.title}
            </strong>{' '}
            ({current.status.replace('_', ' ')})
          </p>
        )}
      </Card>

      <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/projects/${p.id}?tab=${t}`}
            scroll={false}
            data-testid={`tab-${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-primary text-fg' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>

      {p.status === 'disputed' && (
        <Alert tone="warning" data-testid="dispute-banner">
          A dispute is open. Funds stay held and the project is frozen until an administrator decides.{' '}
          <Link className="underline" href={`/projects/${p.id}?tab=disputes`}>
            View the case
          </Link>
        </Alert>
      )}
      {tab === 'overview' && (
        <>
          <MilestonesPanel project={p} />
          <ReviewsPanel projectId={p.id} isSeller={isSeller} milestones={p.milestones} />
        </>
      )}
      {tab === 'timeline' && <Timeline milestones={p.milestones} />}
      {tab === 'board' && (
        <div className="flex flex-col gap-6">
          <Board projectId={p.id} isSeller={isSeller} milestones={p.milestones} editable={editable} />
          {isSeller && editable && <MeetingNotes projectId={p.id} milestones={p.milestones} />}
        </div>
      )}
      {tab === 'deliverables' && (
        <Deliverables projectId={p.id} isSeller={isSeller} milestones={p.milestones} editable={editable} />
      )}
      {tab === 'previews' && (
        <Previews projectId={p.id} isSeller={isSeller} milestones={p.milestones} editable={editable} />
      )}
      {tab === 'changes' && <Changes projectId={p.id} editable={p.status === 'active'} />}
      {tab === 'disputes' && <Disputes projectId={p.id} />}
      {tab === 'reports' && <Reports projectId={p.id} isSeller={isSeller} />}
      {tab === 'meetings' && <Meetings projectId={p.id} myId={myId} />}
      {tab === 'code' && <CodeActivity projectId={p.id} isSeller={isSeller} />}
      {tab === 'activity' && <Activity projectId={p.id} />}
      {tab === 'chat' &&
        (conversationId ? (
          <ChatPanel conversationId={conversationId} myId={myId} />
        ) : (
          <Alert tone="danger">Chat is unavailable right now.</Alert>
        ))}
    </>
  );
}

export function ProjectRoom(props: {
  project: ProjectView;
  tab: Tab;
  conversationId: string | null;
  myId: string;
}) {
  const join = [
    { projectId: props.project.id },
    ...(props.conversationId ? [{ conversationId: props.conversationId }] : []),
  ];
  return (
    <RealtimeProvider join={join}>
      <Inner {...props} />
    </RealtimeProvider>
  );
}
