import type { InputHTMLAttributes } from 'react';
import { cn } from '../cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  );
}
