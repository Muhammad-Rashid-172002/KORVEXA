'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { gw } from '@/lib/gw';

const cents = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : Math.round(Number(s) * 100);
};

export function NewRequestForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    const r = await gw<{ id: string }>('POST', '/briefs', {
      title: String(f.get('title')).trim(),
      description: String(f.get('description')).trim(),
      budgetMinAmount: cents(f.get('min')),
      budgetMaxAmount: cents(f.get('max')),
    });
    setPending(false);
    if (!r.data) return setError(r.error);
    router.push(`/requests/${r.data.id}`);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <Field id="title" label="Title" required minLength={5} maxLength={120} />
      <TextareaField
        id="description"
        label="What do you need?"
        rows={8}
        required
        minLength={30}
        maxLength={5000}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="min" label="Budget from (USD, optional)" type="number" min={0} step="1" />
        <Field id="max" label="Budget up to (USD, optional)" type="number" min={0} step="1" />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Posting…' : 'Post request'}
      </Button>
    </form>
  );
}
