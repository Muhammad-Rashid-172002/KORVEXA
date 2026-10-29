'use client';
import { brand } from '@glasswork/shared/brand';
import { Alert } from '@glasswork/ui/components/alert';
import { Briefcase, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

/** First screen after signup: one question, two big answers, each leading into a guided start. */
export function WelcomeChoice({ name, isSeller }: { name: string; isSeller: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(kind: 'buy' | 'sell') {
    setBusy(kind);
    setError(null);
    if (kind === 'sell') {
      if (!isSeller) {
        const r = await gw('POST', '/me/seller');
        if (!r.ok) {
          setBusy(null);
          return setError(r.error);
        }
      } else await gw('PATCH', '/me/mode', { mode: 'seller' });
    } else {
      await gw('PATCH', '/me/mode', { mode: 'buyer' });
    }
    await gw('PATCH', '/me/onboarding', { welcomed: true });
    router.push(kind === 'sell' ? '/seller/onboarding' : '/services?welcome=1');
    router.refresh();
  }

  const card =
    'card-lift group flex cursor-pointer flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6 text-left transition-colors hover:border-primary disabled:opacity-60';
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-14">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome{name ? `, ${name}` : ''}! What brings you to {brand.productName}?
        </h1>
        <p className="mt-3 text-muted">
          Pick one to get started. You can switch any time from the top of the page.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          className={card}
          disabled={!!busy}
          onClick={() => void choose('buy')}
          data-testid="welcome-hire"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Search size={24} aria-hidden />
          </span>
          <span className="text-lg font-semibold">I want to hire someone</span>
          <span className="text-sm text-muted">
            Find a checked expert for your app, website or AI project. We will show you around.
          </span>
        </button>
        <button
          type="button"
          className={card}
          disabled={!!busy}
          onClick={() => void choose('sell')}
          data-testid="welcome-sell"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Briefcase size={24} aria-hidden />
          </span>
          <span className="text-lg font-semibold">I want to offer my services</span>
          <span className="text-sm text-muted">
            Set up your profile and create your first service with our step-by-step guide.
          </span>
        </button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-center text-sm text-muted">
        <Link
          className="underline-offset-4 hover:underline"
          href="/dashboard"
          onClick={() => void gw('PATCH', '/me/onboarding', { welcomed: true })}
        >
          Skip for now
        </Link>
      </p>
    </div>
  );
}
