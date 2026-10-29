import type { ProfileView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { publicGw } from '@/lib/public-api';
import { serverGw } from '@/lib/server-gw';
import { GigWizard, type Category } from '../gig-wizard';

export const metadata: Metadata = { title: 'Create a service' };
export const dynamic = 'force-dynamic';

export default async function NewServicePage() {
  const [mine, me, cats] = await Promise.all([
    serverGw('/me/services'),
    serverGw<ProfileView>('/me/profile'),
    publicGw<Category[]>('/categories'),
  ]);
  if (mine.status === 401) redirect('/login?next=/sell/services/new');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your service</h1>
        <p className="mt-1 text-sm text-muted">
          Six short steps. Your work is saved as you go, and you can come back any time.
        </p>
      </div>
      {me.data?.seller && !me.data.seller.onboardingCompleted && (
        <Alert tone="warning" data-testid="profile-incomplete">
          You can fill this in now, but you need to finish your seller profile before you can send the service
          for review.{' '}
          <Link className="underline" href="/seller/onboarding">
            Finish my profile
          </Link>
        </Alert>
      )}
      <GigWizard categories={cats.data ?? []} sellerName={me.data?.displayName ?? 'You'} />
    </div>
  );
}
