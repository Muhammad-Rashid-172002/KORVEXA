'use client';
import type { VerificationKind } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { gw, uploadFile } from '@/lib/gw';

const HINT: Record<VerificationKind, string> = {
  identity: 'Upload a clear photo or PDF of a government ID. Only administrators can open it.',
  github: 'Link your GitHub profile, or sign in with GitHub to be verified automatically.',
  play_store: 'Link your Google Play developer or app listing (play.google.com).',
  app_store: 'Link your App Store developer or app listing (apps.apple.com).',
  portfolio: 'Link a portfolio of work we can review.',
  skill_test: 'Skill tests are scheduled by our team after you request one.',
};

export function VerificationForm({ kind }: { kind: VerificationKind }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      let evidenceFileId: string | undefined;
      const file = f.get('file') as File | null;
      if (kind === 'identity') {
        if (!file?.size) throw new Error('Choose a document to upload');
        evidenceFileId = await uploadFile(file, 'evidence');
      }
      const url = String(f.get('url') ?? '').trim();
      const r = await gw('POST', '/me/verifications', {
        kind,
        url: url || undefined,
        handle: String(f.get('handle') ?? '').trim() || undefined,
        note: String(f.get('note') ?? '').trim() || undefined,
        evidenceFileId,
      });
      if (!r.ok) throw new Error(r.error ?? 'Could not send the request');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid={`verification-form-${kind}`}>
      <p className="text-xs text-muted">{HINT[kind]}</p>
      <div className="flex flex-wrap items-end gap-2">
        {kind === 'identity' ? (
          <input
            type="file"
            name="file"
            aria-label="Identity document"
            accept="image/png,image/jpeg,application/pdf"
            data-testid="identity-file"
          />
        ) : (
          <>
            {kind !== 'skill_test' && (
              <input
                name="url"
                type="url"
                aria-label={`${kind} link`}
                placeholder="https://…"
                className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
              />
            )}
            {kind === 'github' && (
              <input
                name="handle"
                aria-label="GitHub handle"
                placeholder="@handle"
                className="h-9 w-40 rounded-md border border-border bg-bg px-3 text-sm"
              />
            )}
            <input
              name="note"
              aria-label="Note"
              placeholder="Note for the reviewer (optional)"
              className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
            />
          </>
        )}
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Request verification'}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  );
}
