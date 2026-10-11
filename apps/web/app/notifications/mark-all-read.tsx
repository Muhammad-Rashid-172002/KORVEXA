'use client';
import { useRouter } from 'next/navigation';
import { gw } from '@/lib/gw';

export function MarkAllRead() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-primary underline-offset-4 hover:underline"
      onClick={async () => {
        await gw('POST', '/me/notifications/read', {});
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
