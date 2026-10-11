'use client';
import type { ServiceStatus } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export function ServiceActions({ id, status, slug }: { id: string; status: ServiceStatus; slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function run(method: string, path: string) {
    const r = await gw(method, path);
    if (!r.ok) setError(r.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="secondary">
        <Link href={`/sell/services/${id}`}>Edit</Link>
      </Button>
      {(status === 'draft' || status === 'rejected') && (
        <Button size="sm" onClick={() => void run('POST', `/me/services/${id}/submit`)}>
          Submit for review
        </Button>
      )}
      {status === 'live' && (
        <>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/services/${slug}`}>View public page</Link>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void run('POST', `/me/services/${id}/pause`)}>
            Pause
          </Button>
        </>
      )}
      {status === 'paused' && (
        <Button size="sm" onClick={() => void run('POST', `/me/services/${id}/resume`)}>
          Resume
        </Button>
      )}
      {status !== 'live' && status !== 'pending_review' && (
        <Button size="sm" variant="ghost" onClick={() => void run('DELETE', `/me/services/${id}`)}>
          Delete
        </Button>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
