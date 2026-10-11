'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function PayoutActions({ id, amount }: { id: string; amount: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function decide(path: 'mark-paid' | 'mark-failed', body: unknown) {
    const r = await gw('POST', `/admin/payouts/${id}/${path}`, body);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void decide('mark-paid', {
            reference: String(new FormData(e.currentTarget).get('reference')).trim(),
          });
        }}
      >
        <input
          name="reference"
          required
          minLength={2}
          aria-label={`Bank reference for ${amount} payout`}
          placeholder="Bank transfer reference"
          className="h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm"
        />
        <Button size="sm" type="submit">
          Mark paid
        </Button>
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => void decide('mark-failed', { note: 'Transfer failed' })}
        >
          Mark failed
        </Button>
      </form>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
