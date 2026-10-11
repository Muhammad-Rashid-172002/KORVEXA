import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth-card';
import { AcceptInvite } from './accept-invite';

export const metadata: Metadata = { title: 'Accept invitation' };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Join an organization">
      <AcceptInvite token={token ?? ''} />
    </AuthCard>
  );
}
