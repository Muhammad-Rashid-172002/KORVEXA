import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Marketing page section with consistent vertical rhythm and a 1152px content column. */
export function Section({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('px-4 py-16 sm:py-24', className)} {...props}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}
