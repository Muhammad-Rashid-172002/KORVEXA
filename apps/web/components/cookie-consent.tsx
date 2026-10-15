'use client';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONSENT_EVENT, readConsent, writeConsent } from '@/lib/consent';

/** Essential cookies need no consent; analytics only load after "Accept analytics". Choice is reversible. */
/** Analytics only exists when a key is configured; with no key there is nothing to consent to, so no banner. */
export const ANALYTICS_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ANALYTICS_CONFIGURED) return;
    setOpen(readConsent() === null);
    const reopen = () => setOpen(true);
    window.addEventListener('gw:open-cookie-settings', reopen);
    return () => window.removeEventListener('gw:open-cookie-settings', reopen);
  }, []);
  if (!open) return null;
  const choose = (v: 'all' | 'essential') => {
    writeConsent(v);
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      data-testid="cookie-banner"
      className="glass fixed inset-x-3 bottom-3 z-50 max-w-md rounded-xl p-4 shadow-2xl sm:left-4 sm:right-auto"
    >
      <p className="text-sm">
        We use essential cookies to keep you signed in. With your permission we also use analytics to improve
        the product.{' '}
        <Link href="/legal/cookies" className="text-primary underline-offset-4 hover:underline">
          Cookie policy
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => choose('all')}>
          Accept analytics
        </Button>
        <Button size="sm" variant="secondary" onClick={() => choose('essential')}>
          Essential only
        </Button>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  if (!ANALYTICS_CONFIGURED) return null;
  return (
    <button
      type="button"
      className="cursor-pointer text-left text-fg/80 hover:text-primary"
      onClick={() => window.dispatchEvent(new Event('gw:open-cookie-settings'))}
    >
      Cookie settings
    </button>
  );
}

export { CONSENT_EVENT };
