'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function ModePanel({ isSeller, activeMode }: { isSeller: boolean; activeMode: 'buyer' | 'seller' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setPending(true);
    setError(null);
    const r = await fn();
    setPending(false);
    if (!r.ok) setError(r.error);
    else router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Mode</CardTitle>
      <CardDescription>
        One account, two hats. You are currently in <strong data-testid="active-mode">{activeMode}</strong>{' '}
        mode.
      </CardDescription>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {isSeller ? (
          <>
            <Button
              variant={activeMode === 'buyer' ? 'primary' : 'secondary'}
              disabled={pending || activeMode === 'buyer'}
              onClick={() => run(() => gw('PATCH', '/me/mode', { mode: 'buyer' }))}
            >
              Switch to buyer
            </Button>
            <Button
              variant={activeMode === 'seller' ? 'primary' : 'secondary'}
              disabled={pending || activeMode === 'seller'}
              onClick={() => run(() => gw('PATCH', '/me/mode', { mode: 'seller' }))}
            >
              Switch to seller
            </Button>
            <Button asChild variant="ghost">
              <Link href="/seller/onboarding">Seller profile setup</Link>
            </Button>
          </>
        ) : (
          <Button disabled={pending} onClick={() => run(() => gw('POST', '/me/seller'))}>
            Become a seller
          </Button>
        )}
      </div>
    </Card>
  );
}
