'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '@/lib/format';
import { gw } from '@/lib/gw';

interface Props {
  payment: {
    id: string;
    status: string;
    amount: number;
    buyerFeeAmount: number;
    currency: string;
    projectId: string | null;
  };
}

/** Stand-in for a hosted payment page while PAYMENTS_PROVIDER=test. The result travels as a signed webhook, like Stripe's. */
export function TestCheckout({ payment }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const total = payment.amount + payment.buyerFeeAmount;
  const back = payment.projectId ? `/projects/${payment.projectId}` : '/projects';

  async function complete(outcome: 'succeeded' | 'failed') {
    setPending(true);
    setError(null);
    const r = await gw('POST', `/payments/${payment.id}/simulate`, { outcome });
    setPending(false);
    if (!r.ok) return setError(r.error);
    router.push(back);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <Alert tone="warning">
        <strong>Test mode.</strong> This is a simulated checkout. No real card is used and no real money
        moves.
      </Alert>
      <Card className="flex flex-col gap-3">
        <CardTitle>Pay {money(total, payment.currency)}</CardTitle>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Milestone</dt>
            <dd className="tabular-nums">{money(payment.amount, payment.currency)}</dd>
          </div>
          {payment.buyerFeeAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Service fee</dt>
              <dd className="tabular-nums">{money(payment.buyerFeeAmount, payment.currency)}</dd>
            </div>
          )}
        </dl>
        {payment.status !== 'pending' ? (
          <Alert>This payment is already {payment.status}.</Alert>
        ) : (
          <div className="flex flex-col gap-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button disabled={pending} onClick={() => void complete('succeeded')}>
              {pending ? 'Processing…' : 'Pay (simulate success)'}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => void complete('failed')}>
              Simulate a declined card
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
