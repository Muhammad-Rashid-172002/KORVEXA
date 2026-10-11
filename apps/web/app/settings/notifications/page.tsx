import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { PreferencesForm } from './preferences-form';

export const metadata: Metadata = { title: 'Notification settings' };
export const dynamic = 'force-dynamic';

export interface Pref {
  type: string;
  label: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export default async function NotificationSettingsPage() {
  const res = await serverGw<Pref[]>('/me/notification-preferences');
  if (res.status === 401 || !res.data) redirect('/login?next=/settings/notifications');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Notification settings</h1>
      <PreferencesForm initial={res.data} />
    </div>
  );
}
