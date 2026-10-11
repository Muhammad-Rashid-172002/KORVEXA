'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { authClient } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/config';

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    await authClient.requestPasswordReset({
      email: String(new FormData(e.currentTarget).get('email')),
      redirectTo: `${WEB_URL}/reset-password`,
    });
    setPending(false);
    setSent(true); // Always the same answer: never reveal whether an email has an account.
  }

  return (
    <AuthCard title="Forgot your password?" subtitle="We will email you a link to choose a new one.">
      {sent ? (
        <Alert tone="success">If an account exists for that address, a reset link is on its way.</Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field id="email" label="Email" type="email" autoComplete="email" required />
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/login">
        Back to log in
      </Link>
    </AuthCard>
  );
}
