import type { MilestoneView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' }) : '—';

/** Planned vs actual per milestone (brief §8.1: "milestone roadmap, planned vs actual dates"). */
export function Timeline({ milestones }: { milestones: MilestoneView[] }) {
  return (
    <ol className="flex flex-col gap-0" data-testid="timeline">
      {milestones.map((m, i) => {
        const late =
          m.plannedDue && m.approvedAt && new Date(m.approvedAt).toISOString().slice(0, 10) > m.plannedDue;
        const overdue =
          m.plannedDue &&
          !m.approvedAt &&
          !['released', 'cancelled', 'refunded'].includes(m.status) &&
          m.plannedDue < new Date().toISOString().slice(0, 10);
        return (
          <li key={m.id} className="flex gap-4" data-testid={`timeline-${m.position}`}>
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 size-3 rounded-full ${['released', 'approved'].includes(m.status) ? 'bg-primary' : m.status === 'pending' ? 'bg-border' : 'bg-warning'}`}
                aria-hidden
              />
              {i < milestones.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className="flex flex-1 flex-col gap-1 pb-6">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {m.position}. {m.title}
                <Badge>{m.status.replace('_', ' ')}</Badge>
                {overdue && <Badge className="border-danger/50 text-danger">overdue</Badge>}
                {late && <Badge className="border-warning/50 text-warning">finished late</Badge>}
              </p>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-muted">Planned due</dt>
                  <dd>{m.plannedDue ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted">Submitted</dt>
                  <dd>{day(m.submittedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Approved</dt>
                  <dd>{day(m.approvedAt)}</dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
