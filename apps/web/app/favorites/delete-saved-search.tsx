'use client';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { gw } from '@/lib/gw';

export function DeleteSavedSearch({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Delete saved search ${name}`}
      onClick={async () => {
        await gw('DELETE', `/me/saved-searches/${id}`);
        router.refresh();
      }}
    >
      Delete
    </Button>
  );
}
