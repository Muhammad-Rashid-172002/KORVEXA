'use client';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../cn';

/** Determinate progress (project %, milestones). `value` is 0..100. */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <ProgressPrimitive.Root
      value={v}
      aria-label={label}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${v}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
