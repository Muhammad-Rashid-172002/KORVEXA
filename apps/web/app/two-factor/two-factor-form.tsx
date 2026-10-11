'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { authClient } from '@/lib/auth-client';
import { safeNext } from '@/lib/safe-next';

export function TwoFactorForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    const { error: err } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    if (err) return setError('That code is not valid.');
    router.push(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Two-factor authentication"
      subtitle={
        useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Field id="code" label={useBackup ? 'Backup code' : 'Code'} autoComplete="one-time-code" required />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit">Verify</Button>
      </form>
      <button
        type="button"
        className="self-start text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => setUseBackup((v) => !v)}
      >
        {useBackup ? 'Use authenticator code' : 'Use a backup code'}
      </button>
    </AuthCard>
  );
}
