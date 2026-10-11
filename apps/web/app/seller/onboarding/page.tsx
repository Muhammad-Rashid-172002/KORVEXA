import type { OnboardingStatus, ProfileView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { Wizard } from './wizard';

export const metadata: Metadata = { title: 'Seller setup' };
export const dynamic = 'force-dynamic';

export default async function SellerOnboardingPage() {
  const [profile, status] = await Promise.all([
    serverGw<ProfileView>('/me/profile'),
    serverGw<OnboardingStatus>('/me/seller/onboarding'),
  ]);
  if (profile.status === 401) redirect('/login');
  // 422 = not a seller yet; send them to settings where "Become a seller" lives.
  if (!profile.data || !profile.data.seller || !status.data) redirect('/settings');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your seller profile</h1>
        <p className="text-sm text-muted">
          Finish the required steps to publish. Payout and identity steps are placeholders until payments go
          live.
        </p>
      </div>
      <Wizard profile={profile.data} status={status.data} />
    </div>
  );
}
