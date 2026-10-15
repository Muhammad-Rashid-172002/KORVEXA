import type { ReactNode } from 'react';
import { cn } from '../cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted [&>svg]:size-8">{icon}</div> : null}
      <p className="text-base font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
