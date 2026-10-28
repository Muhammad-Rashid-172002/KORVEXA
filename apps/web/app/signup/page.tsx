import type { Metadata } from 'next';
import { serverOAuthProviders } from '@/lib/oauth-providers';
import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Sign up' };

export default async function SignupPage() {
  return <SignupForm providers={await serverOAuthProviders()} />;
}
