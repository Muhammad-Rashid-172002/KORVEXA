'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { gw } from '@/lib/gw';

interface Settings {
  buyerServiceBps: number;
  buyerServiceMin: number;
  sellerCommissionBps: number;
  sellerCommissionMin: number;
  autoApproveDays: number;
}

export function FeeSettingsForm({ initial }: { initial: Settings }) {
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    const r = await gw('PUT', '/admin/settings/fees', {
      buyerServiceBps: n('buyerServiceBps'),
      buyerServiceMin: n('buyerServiceMin'),
      sellerCommissionBps: n('sellerCommissionBps'),
      sellerCommissionMin: n('sellerCommissionMin'),
      autoApproveDays: n('autoApproveDays'),
    });
    setMsg(r.ok ? { tone: 'success', text: 'Saved.' } : { tone: 'danger', text: r.error ?? 'Failed' });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="buyerServiceBps"
          label="Buyer service fee (bps)"
          type="number"
          min={0}
          max={10000}
          defaultValue={initial.buyerServiceBps}
          required
        />
        <Field
          id="buyerServiceMin"
          label="Buyer fee minimum (cents)"
          type="number"
          min={0}
          defaultValue={initial.buyerServiceMin}
          required
        />
        <Field
          id="sellerCommissionBps"
          label="Seller commission (bps)"
          type="number"
          min={0}
          max={10000}
          defaultValue={initial.sellerCommissionBps}
          required
        />
        <Field
          id="sellerCommissionMin"
          label="Seller commission minimum (cents)"
          type="number"
          min={0}
          defaultValue={initial.sellerCommissionMin}
          required
        />
        <Field
          id="autoApproveDays"
          label="Auto-approve after (days)"
          type="number"
          min={1}
          max={30}
          defaultValue={initial.autoApproveDays}
          required
        />
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" className="self-start">
        Save settings
      </Button>
    </form>
  );
}
