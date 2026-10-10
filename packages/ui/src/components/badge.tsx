import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted', className)}
      {...props}
    />
  );
}
