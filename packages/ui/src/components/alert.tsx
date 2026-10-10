import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

const tones = {
  info: 'border-info/40 text-fg',
  success: 'border-success/40 text-fg',
  warning: 'border-warning/40 text-fg',
  danger: 'border-danger/50 text-fg',
} as const;

export function Alert({
  tone = 'info',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border bg-surface-2 px-4 py-3 text-sm', tones[tone], className)}
      {...props}
    />
  );
}
