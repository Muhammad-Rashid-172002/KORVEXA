import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import { WelcomeChoice } from './welcome-choice';

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/v1/me');
  if (response.status === 401 || !me) redirect('/login?next=/welcome');
  const first = (me.displayName ?? me.name ?? '').split(' ')[0] ?? '';
  return <WelcomeChoice name={first} isSeller={me.roles.includes('seller')} />;
}
