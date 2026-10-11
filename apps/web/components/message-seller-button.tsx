'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function MessageSellerButton({ sellerId, next }: { sellerId: string; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const r = await gw<{ conversationId: string }>('POST', '/conversations/direct', {
            userId: sellerId,
          });
          if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(next)}`);
          if (!r.data)
            return setError(
              r.status === 422 ? 'This is your own account.' : (r.error ?? 'Could not start a conversation'),
            );
          router.push(`/messages/${r.data.conversationId}`);
        }}
      >
        Message seller
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  );
}
