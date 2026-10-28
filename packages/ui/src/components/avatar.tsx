'use client';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps } from 'react';
import { cn } from '../cn';

const sizes = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-14 text-lg', xl: 'size-24 text-3xl' };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  ).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  ...props
}: Omit<ComponentProps<typeof AvatarPrimitive.Root>, 'children'> & {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none overflow-hidden rounded-full border border-border bg-surface-2',
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        className="flex size-full items-center justify-center bg-primary/15 font-medium text-fg"
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
