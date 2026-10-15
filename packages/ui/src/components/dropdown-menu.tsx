'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '../cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuSeparator = (p: ComponentProps<typeof Menu.Separator>) => (
  <Menu.Separator className="-mx-1 my-1 h-px bg-border" {...p} />
);

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={8}
        align="end"
        className={cn('glass z-50 min-w-48 rounded-lg p-1 shadow-xl', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}
