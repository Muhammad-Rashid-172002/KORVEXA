'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { OAuthButtons } from '@/components/oauth-buttons';
import { authClient } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/config';
import { safeNext } from '@/lib/safe-next';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get('error') ? 'Sign-in with that provider failed.' : null,
  );
  const next = safeNext(params.get('next'));
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    setPending(true);
    setError(null);
    setUnverifiedEmail(null);
    const { data, error: err } = await authClient.signIn.email({
      email,
      password: String(form.get('password')),
      callbackURL: `${WEB_URL}${next}`,
    });
    setPending(false);
    if (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email);
        return;
      }
      setError(
        err.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Incorrect email or password.',
      );
      return;
    }
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      router.push(`/two-factor?next=${encodeURIComponent(next)}`);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <AuthCard title="Log in">
      <OAuthButtons />
      <form className="flex flex-col gap-4" method="post" onSubmit={onSubmit}>
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required />
        {params.get('reset') && (
          <Alert tone="success">Password updated. Log in with your new password.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {unverifiedEmail && (
          <Alert tone="warning">
            Please verify your email first. We just sent a new link to <strong>{unverifiedEmail}</strong>.
          </Alert>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="text-sm text-muted">
        <Link className="text-primary underline-offset-4 hover:underline" href="/forgot-password">
          Forgot your password?
        </Link>
      </p>
      <p className="text-sm text-muted">
        New here?{' '}
        <Link className="text-primary underline-offset-4 hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
