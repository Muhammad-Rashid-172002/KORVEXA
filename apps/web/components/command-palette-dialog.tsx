'use client';
import { Dialog, DialogContent } from '@glasswork/ui/components/dialog';
import { Command } from 'cmdk';
import {
  Bell,
  Briefcase,
  FileText,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

type Item = { label: string; href: string; icon: ReactNode; signedIn?: boolean; keywords?: string };

const ITEMS: Item[] = [
  { label: 'Browse services', href: '/services', icon: <Search size={16} />, keywords: 'find gigs search' },
  {
    label: 'Buyer requests',
    href: '/requests',
    icon: <FileText size={16} />,
    keywords: 'jobs briefs proposals',
  },
  {
    label: 'AI brief builder',
    href: '/requests/new/ai',
    icon: <Sparkles size={16} />,
    keywords: 'idea brief',
  },
  { label: 'Find a match', href: '/match', icon: <Sparkles size={16} />, keywords: 'recommend sellers' },
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} />, signedIn: true },
  {
    label: 'My projects',
    href: '/projects',
    icon: <Briefcase size={16} />,
    signedIn: true,
    keywords: 'orders room',
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: <MessageSquare size={16} />,
    signedIn: true,
    keywords: 'chat',
  },
  { label: 'Notifications', href: '/notifications', icon: <Bell size={16} />, signedIn: true },
  { label: 'Favorites', href: '/favorites', icon: <Heart size={16} />, signedIn: true, keywords: 'saved' },
  {
    label: 'Billing & receipts',
    href: '/billing',
    icon: <Wallet size={16} />,
    signedIn: true,
    keywords: 'invoices',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings size={16} />,
    signedIn: true,
    keywords: 'profile security 2fa',
  },
  { label: 'How it works', href: '/how-it-works', icon: <FileText size={16} /> },
  { label: 'Fees & payment protection', href: '/pricing', icon: <Wallet size={16} /> },
];

/** The heavy part (cmdk + dialog). Loaded on first ⌘K so it never costs anything on page load. */
export default function PaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Quick navigation" className="max-w-xl p-0 [&>div]:mt-0 [&>h2]:sr-only">
        <Command label="Quick navigation" className="flex flex-col">
          <Command.Input
            placeholder="Go to…"
            className="h-12 border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted"
          />
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
            {ITEMS.filter((i) => !i.signedIn || session).map((i) => (
              <Command.Item
                key={i.href}
                value={`${i.label} ${i.keywords ?? ''}`}
                onSelect={() => go(i.href)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-surface-2"
              >
                <span className="text-muted" aria-hidden>
                  {i.icon}
                </span>
                {i.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
