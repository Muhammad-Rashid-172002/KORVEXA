'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { money } from '@/lib/format';
import { gw } from '@/lib/gw';

export function ResolveForm({
  id,
  amount,
  currency,
  status,
}: {
  id: string;
  amount: number;
  currency: string;
  status: string;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<'release' | 'refund' | 'split'>('release');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const refund = Math.round(Number(f.get('refund') || 0) * 100);
    const r = await gw('POST', `/admin/disputes/${id}/resolve`, {
      outcome,
      ...(outcome === 'split' && { refundAmount: refund }),
      note: String(f.get('note')).trim(),
    });
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="resolve-card">
      <CardTitle>Decision</CardTitle>
      {status === 'open' && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={async () => {
            await gw('POST', `/admin/disputes/${id}/review`);
            router.refresh();
          }}
        >
          Mark as under review
        </Button>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="sr-only">Outcome</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="outcome"
              checked={outcome === 'release'}
              onChange={() => setOutcome('release')}
            />
            Release to the seller ({money(amount, currency)}, commission applies)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="outcome"
              checked={outcome === 'refund'}
              onChange={() => setOutcome('refund')}
            />
            Refund the buyer in full (milestone and service fee)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="outcome"
              checked={outcome === 'split'}
              onChange={() => setOutcome('split')}
            />
            Split
          </label>
        </fieldset>
        {outcome === 'split' && (
          <label className="flex items-center gap-2 text-sm">
            Refund to buyer (USD, of {money(amount, currency)})
            <input
              name="refund"
              type="number"
              min={0.01}
              step="0.01"
              max={(amount - 1) / 100}
              required
              className="h-9 w-32 rounded-md border border-border bg-bg px-2 text-sm"
            />
          </label>
        )}
        <textarea
          name="note"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          aria-label="Resolution note"
          placeholder="Reasoning shown to both parties (min 10 characters)"
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" className="self-start">
          Resolve dispute
        </Button>
      </form>
    </Card>
  );
}
