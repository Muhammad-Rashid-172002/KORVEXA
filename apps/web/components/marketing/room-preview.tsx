import { Badge } from '@glasswork/ui/components/badge';
import { Progress } from '@glasswork/ui/components/progress';
import { CheckCircle2, Circle, CircleDot, ShieldCheck } from 'lucide-react';

const MILESTONES = [
  { name: 'Discovery & wireframes', state: 'done', amount: '$600', note: 'Approved by buyer' },
  { name: 'Core app build', state: 'active', amount: '$1,800', note: 'In progress · 6 of 9 tasks done' },
  { name: 'Payments & launch', state: 'todo', amount: '$900', note: 'Funds when work begins' },
] as const;

/**
 * Illustrative Project Room built from the real UI components. It is labelled as an example everywhere it appears:
 * the marketing site never shows invented customers, counts or logos (brief §4.4).
 */
export function RoomPreview() {
  return (
    <div
      className="glass overflow-hidden rounded-2xl shadow-2xl"
      role="img"
      aria-label="Illustrative project room: three milestones, one in progress, money held safely"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gw-glass-border)] px-5 py-3">
        <div>
          <p className="text-xs text-muted">Example project</p>
          <p className="font-medium">Booking app for a yoga studio</p>
        </div>
        <Badge className="border-success/50 text-success">On track</Badge>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">Overall progress</p>
            <p className="text-2xl font-semibold tabular-nums">46%</p>
          </div>
          <Progress value={46} label="Overall progress 46 percent" className="mt-2" />
          <ul className="mt-5 space-y-3">
            {MILESTONES.map((m) => (
              <li
                key={m.name}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-3"
              >
                {m.state === 'done' ? (
                  <CheckCircle2 size={18} className="mt-0.5 text-success" aria-hidden />
                ) : m.state === 'active' ? (
                  <CircleDot size={18} className="mt-0.5 text-primary" aria-hidden />
                ) : (
                  <Circle size={18} className="mt-0.5 text-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.note}</p>
                </div>
                <p className="text-sm tabular-nums">{m.amount}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={16} className="text-primary" aria-hidden /> Held safely
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Held for current milestone</dt>
                <dd className="tabular-nums">$1,800</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Released to seller</dt>
                <dd className="tabular-nums">$600</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Not yet funded</dt>
                <dd className="tabular-nums">$900</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-border bg-surface/60 p-4">
            <p className="text-sm font-medium">This week, in plain English</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Login and booking screens are built. Next: the calendar sync. One decision needed from you:
              which payment methods to support at launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
