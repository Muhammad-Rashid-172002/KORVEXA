import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Loading placeholder. Prefer over spinners (D-042); motion is disabled under prefers-reduced-motion. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
