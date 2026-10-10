'use client';
import { brand } from '@glasswork/shared/brand';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Field } from '@/components/field';
import { OAuthButtons } from '@/components/oauth-buttons';
import { authClient } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/config';

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signUp.email({
      name: String(form.get('name')),
      email,
      password: String(form.get('password')),
      callbackURL: `${WEB_URL}/dashboard`,
    });
    setPending(false);
    if (err) {
      setError(err.message ?? 'Sign up failed. Please try again.');
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle={`Join ${brand.productName} to hire or offer software work.`}
    >
      <OAuthButtons />
      <form className="flex flex-col gap-4" method="post" onSubmit={onSubmit}>
        <Field id="name" label="Full name" autoComplete="name" required maxLength={100} />
        <Field id="email" label="Email" type="email" autoComplete="email" required />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          hint="At least 10 characters."
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link className="text-primary underline-offset-4 hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
