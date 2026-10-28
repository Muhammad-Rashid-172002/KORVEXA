import type { ProjectListItem } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { EmptyState } from '@glasswork/ui/components/empty-state';
import { Progress } from '@glasswork/ui/components/progress';
import { Stat } from '@glasswork/ui/components/stat';
import {
  BarChart3,
  Briefcase,
  FolderKanban,
  Inbox,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
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

  const isSeller = me.roles.includes('seller');
  const actions = isSeller
    ? [
        {
          href: '/sell/services',
          icon: Briefcase,
          title: 'Your services',
          body: 'Edit packages, pricing and your gallery.',
        },
        {
          href: '/requests',
          icon: Inbox,
          title: 'Open requests',
          body: 'Send proposals to buyers who need your skills.',
        },
        {
          href: '/seller/analytics',
          icon: BarChart3,
          title: 'Analytics',
          body: 'Conversion, response time and on-time delivery.',
        },
        {
          href: '/seller/verification',
          icon: ShieldCheck,
          title: 'Trust and level',
          body: 'Badges and what is left for your next level.',
        },
      ]
    : [
        {
          href: '/requests/new/ai',
          icon: Sparkles,
          title: 'AI brief builder',
          body: 'Turn an idea into a structured brief with milestones.',
        },
        {
          href: '/match',
          icon: Wand2,
          title: 'Find a match',
          body: 'Sellers ranked for your project, with reasons.',
        },
        {
          href: '/services',
          icon: Search,
          title: 'Browse services',
          body: 'Ready-made packages with fixed milestones.',
        },
        {
          href: '/requests/new',
          icon: Briefcase,
          title: 'Post a request',
          body: 'Let sellers send you proposals.',
        },
      ];
  const shortcuts = [
    { href: '/messages', label: 'Messages' },
    { href: '/requests/mine', label: 'My requests' },
    { href: '/billing', label: 'Billing' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/orgs', label: 'Teams' },
    ...(isSeller ? [{ href: '/earnings', label: 'Earnings' }] : []),
    { href: '/settings', label: 'Settings' },
    ...(me.roles.includes('admin') ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {me.displayName ?? me.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {me.email}
            {me.emailVerified && <Badge className="border-primary/40 text-primary">email verified</Badge>}
          </p>
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

      <section aria-labelledby="next-steps" className="flex flex-col gap-3">
        <h2 id="next-steps" className="text-lg font-semibold">
          {isSeller ? 'Grow your business' : 'Start something new'}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="no-underline block h-full">
                <Card className="card-lift flex h-full flex-col gap-2 p-4">
                  <a.icon size={20} className="text-primary" aria-hidden />
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted">{a.body}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav
        aria-label="Account shortcuts"
        className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm"
      >
        {shortcuts.map((l) => (
          <Link key={l.href} className="text-muted no-underline hover:text-primary" href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <details className="group rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium">Connection and private files</summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <CardTitle>Live updates</CardTitle>
            <CardDescription>Whether your browser is receiving real-time updates.</CardDescription>
            <RealtimeStatus />
          </div>
          <div className="flex flex-col gap-3">
            <CardTitle>Your private files</CardTitle>
            <CardDescription>Files only you can see. Uploads go straight to secure storage.</CardDescription>
            <FileUploader />
          </div>
        </div>
      </details>
    </div>
  );
}
