import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/** Role gate for the UI. The API enforces the same rule on every admin endpoint; this only hides the shell. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/v1/me');
  if (response.status === 401 || !me) redirect('/login');
  if (!me.roles.includes('admin')) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Admin">
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin">
            Overview
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/users">
            Users
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/services">
            Moderation
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/disputes">
            Disputes
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/verifications">
            Verifications
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/reports">
            Reports
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/payouts">
            Payouts
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/payments">
            Payments
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/settings">
            Fees
          </Link>
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/audit">
            Audit log
          </Link>
        </nav>
        <span className="text-xs text-muted">scopes: {me.adminScopes.join(', ') || 'none'}</span>
      </div>
      {children}
    </div>
  );
}
