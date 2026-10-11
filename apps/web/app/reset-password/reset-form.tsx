'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { authClient } from '@/lib/auth-client';

export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.resetPassword({
      newPassword: String(new FormData(e.currentTarget).get('password')),
      token: token ?? '',
    });
    setPending(false);
    if (err)
      return setError(
        'This reset link is invalid or has expired, or the password is too short (10+ characters).',
      );
    router.push('/login?reset=1');
  }

  return (
    <AuthCard title="Choose a new password">
      {!token ? (
        <Alert tone="danger">
          This link is missing its token. <Link href="/forgot-password">Request a new one</Link>.
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            hint="At least 10 characters."
            required
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
