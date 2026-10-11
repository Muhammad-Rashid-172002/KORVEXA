'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function ReportActions({
  id,
  targetType,
  targetId,
  ownerId,
  label,
}: {
  id: string;
  targetType: string;
  targetId: string;
  ownerId: string | null;
  label: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    const r = await fn();
    if (!r.ok) return setError(r.error);
    router.refresh();
  }
  const reason = () => note.trim() || 'Violation of the acceptable use policy.';
  const decide = (decision: 'actioned' | 'dismissed') =>
    run(() =>
      gw('POST', `/admin/reports/${id}/decision`, {
        decision,
        note: note.trim() || (decision === 'dismissed' ? 'No violation found.' : 'Action taken.'),
      }),
    );

  return (
    <div className="flex flex-col gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label={`Note for report on ${label}`}
        placeholder="Note / reason (shown in the audit log)"
        className="h-9 rounded-md border border-border bg-bg px-3 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void decide('dismissed')}>
          Dismiss
        </Button>
        {targetType === 'service' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void run(() => gw('POST', `/admin/services/${targetId}/takedown`, { reason: reason() })).then(
                () => decide('actioned'),
              )
            }
          >
            Take down service
          </Button>
        )}
        {ownerId && (
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              void run(() => gw('POST', `/admin/users/${ownerId}/ban`, { reason: reason() })).then(() =>
                decide('actioned'),
              )
            }
          >
            Ban user
          </Button>
        )}
        <Button size="sm" onClick={() => void decide('actioned')}>
          Mark actioned
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
