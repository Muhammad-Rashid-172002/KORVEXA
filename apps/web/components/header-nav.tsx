'use client';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from './theme-toggle';

/** Session-aware navigation. Authorisation is still enforced server-side; this only picks which links to show. */
export function HeaderNav() {
  const { data: session, isPending } = authClient.useSession();
  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {!isPending && session ? (
        <Button asChild size="sm" variant="secondary" className="whitespace-nowrap">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
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
