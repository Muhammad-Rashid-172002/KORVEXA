'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { gw } from '@/lib/gw';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Alert tone="danger">This invitation link is incomplete.</Alert>;
  if (isPending) return <p className="text-sm text-muted">Checking your session…</p>;
  if (!session) {
    const next = encodeURIComponent(`/invites/accept?token=${token}`);
    return (
      <>
        <p className="text-sm text-muted">Log in with the email address the invitation was sent to.</p>
        <Button asChild>
          <Link href={`/login?next=${next}`}>Log in to accept</Link>
        </Button>
      </>
    );
  }
  return (
    <>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        onClick={async () => {
          const r = await gw<{ id: string }>('POST', '/invites/accept', { token });
          if (!r.data)
            return setError('This invitation is invalid, expired, or meant for a different account.');
          router.push(`/orgs/${r.data.id}`);
        }}
      >
        Accept invitation
      </Button>
    </>
  );
}
