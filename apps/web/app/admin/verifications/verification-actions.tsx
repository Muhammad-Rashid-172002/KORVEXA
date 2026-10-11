'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function VerificationActions({ id, hasFile, label }: { id: string; hasFile: boolean; label: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'verified' | 'rejected') {
    const r = await gw('POST', `/admin/verifications/${id}/decision`, {
      decision,
      note: note.trim() || undefined,
    });
    if (!r.ok) return setError(r.error);
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {hasFile && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const r = await gw<{ url: string }>('GET', `/admin/verifications/${id}/evidence`);
              if (r.data) window.open(r.data.url, '_blank', 'noopener,noreferrer');
              else setError(r.error);
            }}
          >
            Open document
          </Button>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={`Note for ${label}`}
          placeholder="Note (required to reject)"
          className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
        <Button size="sm" aria-label={`Verify ${label}`} onClick={() => void decide('verified')}>
          Verify
        </Button>
        <Button
          size="sm"
          variant="danger"
          aria-label={`Reject ${label}`}
          onClick={() => void decide('rejected')}
        >
          Reject
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
