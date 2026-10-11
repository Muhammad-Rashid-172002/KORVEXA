'use client';
import { Button } from '@glasswork/ui/components/button';
import { LayoutDashboard, Search } from 'lucide-react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';

/** Session-aware navigation. Authorisation is still enforced server-side; this only picks which links to show. */
export function HeaderNav() {
  const { data: session, isPending } = authClient.useSession();
  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className={`whitespace-nowrap px-2.5 sm:px-3 ${!isPending && session ? '' : 'max-sm:hidden'}`}
      >
        <Link href="/services" aria-label="Browse services">
          <Search size={16} aria-hidden className="sm:hidden" />
          <span className="max-sm:hidden">Browse</span>
        </Link>
      </Button>
      {!isPending && session ? (
        <>
          <NotificationBell />
          <Button asChild size="sm" variant="secondary" className="whitespace-nowrap">
            <Link href="/dashboard" aria-label="Dashboard">
              <LayoutDashboard size={16} aria-hidden className="sm:hidden" />
              <span className="max-sm:hidden">Dashboard</span>
            </Link>
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm" className="whitespace-nowrap px-2.5 sm:px-3">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="whitespace-nowrap px-2.5 sm:px-3">
            <Link href="/signup">Sign up</Link>
          </Button>
        </>
      )}
      <ThemeToggle />
    </nav>
  );
}
