'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { gw } from '@/lib/gw';

export function CreateOrgForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await gw<{ id: string }>('POST', '/orgs', {
      name: String(f.get('name')).trim(),
      kind: f.get('kind'),
    });
    if (!r.data) return setError(r.error);
    router.push(`/orgs/${r.data.id}`);
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <Field id="name" label="Name" required minLength={2} maxLength={80} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kind" className="text-sm font-medium">
          Type
        </label>
        <select
          id="kind"
          name="kind"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        >
          <option value="buyer_team">Buyer team</option>
          <option value="agency">Seller agency</option>
        </select>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" className="self-start">
        Create
      </Button>
    </form>
  );
}
