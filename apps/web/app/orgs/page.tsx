import { Card, CardTitle } from '@glasswork/ui/components/card';
import { Badge } from '@glasswork/ui/components/badge';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { CreateOrgForm } from './create-org-form';

export const metadata: Metadata = { title: 'Organizations' };
export const dynamic = 'force-dynamic';

export default async function OrgsPage() {
  const orgs = await serverGw<{ id: string; name: string; kind: string; myRole: string }[]>('/orgs');
  if (orgs.status === 401 || !orgs.data) redirect('/login');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      {orgs.data.length === 0 ? (
        <p className="text-sm text-muted">You are not part of any organization yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="org-list">
          {orgs.data.map((o) => (
            <li key={o.id}>
              <Link href={`/orgs/${o.id}`}>
                <Card className="flex items-center justify-between gap-3 hover:bg-surface-2">
                  <CardTitle>{o.name}</CardTitle>
                  <span className="flex gap-2">
                    <Badge>{o.kind === 'agency' ? 'agency' : 'buyer team'}</Badge>
                    <Badge>{o.myRole}</Badge>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card className="flex flex-col gap-3">
        <CardTitle>Create an organization</CardTitle>
        <CreateOrgForm />
      </Card>
    </div>
  );
}
