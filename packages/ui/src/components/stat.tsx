import type { ReactNode } from 'react';
import { cn } from '../cn';

/** KPI tile. `value` null means "not enough data yet" and renders an em dash, never a fake zero (D-098). */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode | null;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value ?? '—'}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
