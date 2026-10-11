'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { gw } from '@/lib/gw';

export function ReplyForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await gw('POST', `/reviews/${reviewId}/reply`, {
      body: String(new FormData(e.currentTarget).get('body')).trim(),
    });
    if (!r.ok) return setError(r.error);
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="reply-form">
      <textarea
        name="body"
        required
        minLength={2}
        maxLength={2000}
        rows={2}
        aria-label="Reply to this review"
        placeholder="Reply publicly (one reply per review)"
        className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="sm" type="submit" className="self-start">
        Post reply
      </Button>
    </form>
  );
}
