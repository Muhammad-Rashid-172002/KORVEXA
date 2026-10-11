'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { gw } from '@/lib/gw';

export function SaveSearchButton({ query }: { query: Record<string, string | number> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const empty = Object.keys(query).length === 0;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('searchName')).trim();
    const r = await gw('POST', '/me/saved-searches', { name, query });
    if (r.status === 401) return router.push('/login?next=/services');
    setMsg(
      r.ok
        ? { tone: 'success', text: 'Search saved. Find it under Favorites.' }
        : { tone: 'danger', text: r.error ?? 'Failed' },
    );
    if (r.ok) setOpen(false);
  }

  return (
    <>
      {open ? (
        <form className="flex items-center gap-2" onSubmit={save}>
          <input
            name="searchName"
            aria-label="Saved search name"
            defaultValue={String(query.q ?? query.category ?? '')}
            minLength={2}
            maxLength={80}
            required
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      ) : (
        <Button type="button" variant="secondary" disabled={empty} onClick={() => setOpen(true)}>
          Save this search
        </Button>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </>
  );
}
