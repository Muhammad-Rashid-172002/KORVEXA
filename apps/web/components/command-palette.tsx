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
import { useEffect, useState, type ReactNode } from 'react';
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
  { label: 'Fees & escrow', href: '/pricing', icon: <Wallet size={16} /> },
];

/** ⌘K / Ctrl+K quick navigation. Pure navigation: authorisation is still enforced by the server. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('gw:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('gw:open-palette', onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

export function PaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('gw:open-palette'))}
      aria-label="Open quick navigation"
      className="hidden h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-xs text-muted hover:text-fg md:flex"
    >
      <Search size={14} aria-hidden /> Search
      <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
