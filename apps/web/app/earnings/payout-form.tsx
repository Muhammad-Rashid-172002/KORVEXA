'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { money } from '@/lib/format';
import { gw, newIdempotencyKey } from '@/lib/gw';

export function PayoutForm({ available, min }: { available: number; min: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const key = useRef(newIdempotencyKey());

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get('amount')).trim();
    const amount = raw === '' ? undefined : Math.round(Number(raw) * 100);
    const r = await gw('POST', '/me/payouts', amount === undefined ? {} : { amount }, {
      'idempotency-key': key.current,
    });
    if (r.ok) {
      key.current = newIdempotencyKey(); // next request is a new intent
      setMsg({ tone: 'success', text: 'Payout requested. Operations will pay it by bank transfer.' });
      router.refresh();
    } else setMsg({ tone: 'danger', text: r.error ?? 'Failed' });
  }

  const disabled = available < min;
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <Field
        id="amount"
        label="Amount (USD), empty = everything available"
        type="number"
        min={min / 100}
        max={available / 100}
        step="0.01"
        disabled={disabled}
        hint={`Available ${money(available)} · minimum ${money(min)}`}
      />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" disabled={disabled} className="self-start">
        Request payout
      </Button>
    </form>
  );
}
