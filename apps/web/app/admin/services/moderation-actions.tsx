'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function ModerationActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body?: unknown) {
    const r = await gw('POST', `/admin/services/${id}/${path}`, body);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" aria-label={`Approve ${title}`} onClick={() => void act('approve')}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Reject ${title}`}
          onClick={() => setRejecting((v) => !v)}
        >
          Reject…
        </Button>
      </div>
      {rejecting && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act('reject', { reason: String(new FormData(e.currentTarget).get('reason')).trim() });
          }}
        >
          <input
            name="reason"
            aria-label="Rejection reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="Reason shown to the seller"
            className="h-9 w-full max-w-md rounded-md border border-border bg-surface px-3 text-sm"
          />
          <Button size="sm" variant="danger" type="submit">
            Confirm reject
          </Button>
        </form>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
