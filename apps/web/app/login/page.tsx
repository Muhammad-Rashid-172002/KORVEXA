import type { Metadata } from 'next';
import { serverOAuthProviders } from '@/lib/oauth-providers';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

/** Query params are read on the server so the form renders in the first HTML (no client-only bailout, no layout shift). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const providers = await serverOAuthProviders();
  return (
    <LoginForm
      providers={providers}
      hasError={Boolean(one(q.error))}
      nextParam={one(q.next) ?? null}
      reset={Boolean(one(q.reset))}
    />
  );
}
