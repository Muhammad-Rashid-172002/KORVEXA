'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function ReplayButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={async () => {
          const r = await gw('POST', `/admin/webhook-events/${id}/replay`);
          if (!r.ok) setError(r.error);
          else router.refresh();
        }}
      >
        Replay
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
