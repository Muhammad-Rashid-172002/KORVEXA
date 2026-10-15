import type { ProjectListItem } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { EmptyState } from '@glasswork/ui/components/empty-state';
import { Progress } from '@glasswork/ui/components/progress';
import { Stat } from '@glasswork/ui/components/stat';
import { FolderKanban } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { money } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import { serverGw } from '@/lib/server-gw';
import { FileUploader } from './file-uploader';
import { RealtimeStatus } from './realtime-status';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/** Protected page: the session is checked server-side against the API on every request. */
export default async function DashboardPage() {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/v1/me');
  if (response.status === 401 || !me) redirect('/login');

  const projectsRes = await serverGw<{ items: ProjectListItem[] }>('/projects?limit=50');
  const all = projectsRes.data?.items ?? [];
  const open = all.filter((p) => !['completed', 'reviewed', 'cancelled'].includes(p.status));
  const done = all.filter((p) => ['completed', 'reviewed'].includes(p.status));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {me.displayName ?? me.name}</h1>
          <p className="text-sm text-muted">{me.email}</p>
        </div>
        <SignOutButton />
      </div>

      <section aria-labelledby="active-projects" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Active projects" value={open.length} />
          <Stat label="Completed" value={done.length} />
          <Stat
            label="Value in active projects"
            value={
              open.length
                ? money(
                    open.reduce((a, p) => a + p.totalAmount, 0),
                    open[0]!.currency,
                  )
                : null
            }
            className="max-sm:col-span-2"
          />
        </div>
        <div className="flex items-center justify-between">
          <h2 id="active-projects" className="text-lg font-semibold">
            Active projects
          </h2>
          <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/projects">
            View all
          </Link>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={<FolderKanban />}
            title="No active projects yet"
            description="Browse services or post a request. Your project room appears here as soon as an order starts."
            action={
              <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/services">
                Browse services
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {open.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="block">
                  <Card className="card-lift flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
                      <Badge>{p.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <Progress value={p.progress} label={`${p.title} progress`} />
                    <p className="flex justify-between text-xs text-muted">
                      <span>
                        {p.code} · {p.myRole === 'buyer' ? 'Seller' : 'Buyer'}: {p.counterparty}
                      </span>
                      <span className="tabular-nums">{p.progress}%</span>
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="flex flex-col gap-3">
        <CardTitle>Your account</CardTitle>
        <div className="flex flex-wrap gap-2" aria-label="Account roles">
          {me.roles.map((r) => (
            <Badge key={r}>{r}</Badge>
          ))}
          <Badge>mode: {me.activeMode}</Badge>
          {me.emailVerified && <Badge className="border-primary/40 text-primary">email verified</Badge>}
        </div>
      </Card>

      <Card className="flex flex-wrap gap-4 text-sm" aria-label="Quick links">
        <Link className="text-primary underline-offset-4 hover:underline" href="/settings">
          Settings
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/projects">
          Projects
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/messages">
          Messages
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/requests">
          Requests
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/billing">
          Billing
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/favorites">
          Favorites
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/orgs">
          Organizations
        </Link>
        {me.roles.includes('seller') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/seller/onboarding">
            Seller setup
          </Link>
        )}
        {me.roles.includes('seller') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/seller/verification">
            Trust &amp; verification
          </Link>
        )}
        {me.roles.includes('seller') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/seller/analytics">
            Analytics
          </Link>
        )}
        <Link className="text-primary underline-offset-4 hover:underline" href="/match">
          Find sellers (AI match)
        </Link>
        {me.roles.includes('seller') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/earnings">
            Earnings
          </Link>
        )}
        {me.roles.includes('seller') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/sell/services">
            My services
          </Link>
        )}
        {me.roles.includes('admin') && (
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin">
            Admin
          </Link>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Realtime</CardTitle>
          <CardDescription>Authenticated Socket.io connection to the API.</CardDescription>
          <RealtimeStatus />
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Files</CardTitle>
          <CardDescription>
            Direct-to-storage upload with a presigned URL. Only you can see your files.
          </CardDescription>
          <FileUploader />
        </Card>
      </div>
    </div>
  );
}
