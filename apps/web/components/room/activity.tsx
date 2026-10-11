'use client';
import { EVENT_FILTERS, type ProjectEventView } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import { useCallback, useEffect, useState } from 'react';
import { gw } from '@/lib/gw';
import { useRealtime } from '@/lib/realtime';

const describe = (e: ProjectEventView): string => {
  const p = e.payload as Record<string, string | number | undefined>;
  const who = e.actor?.name ?? 'The system';
  switch (e.type) {
    case 'project.ordered':
      return `${who} placed the order`;
    case 'project.proposal_accepted':
      return `${who} accepted the proposal`;
    case 'project.offer_accepted':
      return `${who} accepted the custom offer`;
    case 'project.accepted':
      return `${who} accepted the order`;
    case 'project.declined':
      return `${who} declined the order`;
    case 'project.withdrawn':
      return `${who} withdrew the order`;
    case 'project.completed':
      return 'All milestones are complete';
    case 'payment.started':
      return `${who} opened checkout`;
    case 'milestone.funded':
      return `${who} funded “${p.title}”`;
    case 'milestone.started':
      return `${who} started “${p.title}”`;
    case 'milestone.submitted':
      return `${who} submitted “${p.title}” for review`;
    case 'milestone.revision_requested':
      return `${who} requested changes on “${p.title}”${p.note ? `: ${p.note}` : ''}`;
    case 'milestone.approved':
      return `${who} approved “${p.title}”`;
    case 'milestone.auto_approved':
      return `“${p.title}” was approved automatically`;
    case 'milestone.released':
      return `Payment for “${p.title}” was released to the seller`;
    case 'milestone.refunded':
      return `“${p.title}” was refunded`;
    case 'task.created':
      return `${who} added task “${p.title}”`;
    case 'task.moved':
      return `${who} moved “${p.title}” from ${String(p.from).replace('_', ' ')} to ${String(p.to).replace('_', ' ')}`;
    case 'task.commented':
      return `${who} commented on “${p.title}”`;
    case 'deliverable.uploaded':
      return `${who} uploaded ${p.fileName} (version ${p.version})`;
    case 'deliverable.feedback':
      return `${who} left feedback on version ${p.version}`;
    case 'preview.added':
      return `${who} added a preview link: ${p.label}`;
    case 'preview.updated':
      return `${who} updated a preview link: ${p.label}`;
    default:
      return `${who}: ${e.type}`;
  }
};

export function Activity({ projectId }: { projectId: string }) {
  const { tick } = useRealtime();
  const [filter, setFilter] = useState<(typeof EVENT_FILTERS)[number]>('all');
  const [items, setItems] = useState<ProjectEventView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await gw<{ items: ProjectEventView[]; nextCursor: string | null }>(
      'GET',
      `/projects/${projectId}/events?filter=${filter}&limit=30`,
    );
    if (r.data) {
      setItems(r.data.items);
      setCursor(r.data.nextCursor);
    }
    setLoaded(true);
  }, [projectId, filter]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity">
        {EVENT_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'primary' : 'secondary'}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f[0]!.toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>
      {loaded && items.length === 0 ? (
        <p className="text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ol
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface"
          data-testid="activity-feed"
        >
          {items.map((e) => (
            <li
              key={e.id}
              className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
              data-testid="activity-item"
            >
              <span>{describe(e)}</span>
              <time className="shrink-0 text-xs text-muted" dateTime={e.createdAt}>
                {new Date(e.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      )}
      {cursor && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={async () => {
            const r = await gw<{ items: ProjectEventView[]; nextCursor: string | null }>(
              'GET',
              `/projects/${projectId}/events?filter=${filter}&limit=30&cursor=${cursor}`,
            );
            if (r.data) {
              setItems((prev) => [...prev, ...r.data!.items]);
              setCursor(r.data.nextCursor);
            }
          }}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
