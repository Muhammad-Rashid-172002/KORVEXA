'use client';
import { Button } from '@glasswork/ui/components/button';
import { ArrowLeftRight, LayoutDashboard, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { gw } from '@/lib/gw';
import { PaletteButton } from './command-palette';
const NotificationBell = dynamic(() => import('./notification-bell').then((m) => m.NotificationBell), {
  ssr: false,
});
import { ThemeToggle } from './theme-toggle';

type Me = { activeMode: 'buyer' | 'seller'; roles: string[] };

/**
 * Session-aware navigation: at most five main items, and separate buyer and seller menus with a visible switch.
 * Authorisation is still enforced server-side; this only picks which links to show.
 */
export function HeaderNav() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [switching, setSwitching] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return setMe(null);
    let live = true;
    void gw<Me>('GET', '/me').then((r) => live && r.ok && setMe(r.data));
    return () => {
      live = false;
    };
  }, [userId, pathname === '/settings']);

  const signedIn = !isPending && !!session;
  const seller = me?.activeMode === 'seller';
  const isSeller = me?.roles.includes('seller') ?? false;

  async function switchMode() {
    setSwitching(true);
    if (seller) await gw('PATCH', '/me/mode', { mode: 'buyer' });
    else if (isSeller) await gw('PATCH', '/me/mode', { mode: 'seller' });
    else await gw('POST', '/me/seller');
    const next = seller ? 'buyer' : 'seller';
    setMe((m) =>
      m
        ? {
            ...m,
            activeMode: next,
            roles: next === 'seller' ? [...new Set([...m.roles, 'seller'])] : m.roles,
          }
        : m,
    );
    setSwitching(false);
    router.push(next === 'seller' && !isSeller ? '/seller/onboarding' : '/dashboard');
    router.refresh();
  }

  const link = 'whitespace-nowrap px-2.5 sm:px-3';
  return (
    <nav className="flex shrink-0 items-center gap-1" aria-label="Main">
      <PaletteButton />
      {signedIn ? (
        <>
          {seller ? (
            <>
              <Button asChild variant="ghost" size="sm" className={`${link} max-md:hidden`}>
                <Link href="/sell/services">My services</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className={`${link} max-md:hidden`}>
                <Link href="/projects">Orders</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className={link}>
                <Link href="/services" aria-label="Find experts">
                  <Search size={16} aria-hidden className="sm:hidden" />
                  <span className="max-sm:hidden">Find experts</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className={`${link} max-md:hidden`}>
                <Link href="/projects">My projects</Link>
              </Button>
            </>
          )}
          <Button asChild variant="ghost" size="sm" className={`${link} max-md:hidden`}>
            <Link href="/messages">Messages</Link>
          </Button>
          <NotificationBell />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="whitespace-nowrap px-2.5 sm:px-3"
            onClick={() => void switchMode()}
            disabled={switching || !me}
            aria-label={seller ? 'Switch to buying' : isSeller ? 'Switch to selling' : 'Start selling'}
            data-testid="mode-switch"
          >
            <ArrowLeftRight size={16} aria-hidden className="lg:hidden" />
            <span className="max-lg:hidden">
              {seller ? 'Switch to buying' : isSeller ? 'Switch to selling' : 'Start selling'}
            </span>
          </Button>
          <Button asChild size="sm" variant="ghost" className="whitespace-nowrap px-2.5 sm:px-3">
            <Link href="/dashboard" aria-label="Dashboard">
              <LayoutDashboard size={16} aria-hidden className="sm:hidden" />
              <span className="max-sm:hidden">Dashboard</span>
            </Link>
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm" className={`${link} ${isPending ? 'max-sm:hidden' : ''}`}>
            <Link href="/services" aria-label="Browse services">
              <Search size={16} aria-hidden className="sm:hidden" />
              <span className="max-sm:hidden">Browse</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="whitespace-nowrap max-lg:hidden">
            <Link href="/how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="whitespace-nowrap max-lg:hidden">
            <Link href="/for-sellers">Start selling</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className={link}>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className={link}>
            <Link href="/signup">Sign up</Link>
          </Button>
        </>
      )}
      <ThemeToggle />
    </nav>
  );
}
