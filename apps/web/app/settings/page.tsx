import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import type { ProfileView, SessionView } from '@glasswork/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { serverGw } from '@/lib/server-gw';
import { ModePanel } from './mode-panel';
import { ProfileForm } from './profile-form';
import { SecurityPanel } from './security-panel';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/v1/me');
  if (response.status === 401 || !me) redirect('/login');
  const [profile, sessions] = await Promise.all([
    serverGw<ProfileView>('/me/profile'),
    serverGw<SessionView[]>('/me/sessions'),
  ]);
  if (!profile.data) redirect('/login');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <ModePanel isSeller={me.roles.includes('seller')} activeMode={me.activeMode} />

      <Card className="flex flex-col gap-3">
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Shown on your public page once you pick a handle
          {profile.data.slug && (
            <>
              :{' '}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={`/u/${profile.data.slug}`}
              >
                /u/{profile.data.slug}
              </Link>
            </>
          )}
          .
        </CardDescription>
        <ProfileForm profile={profile.data} />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Teams</CardTitle>
        <CardDescription>Invite teammates to a buyer team or run an agency with members.</CardDescription>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/orgs">
          Manage organizations →
        </Link>
      </Card>

      <SecurityPanel sessions={sessions.data ?? []} twoFactorEnabled={me.twoFactorEnabled} />
    </div>
  );
}
