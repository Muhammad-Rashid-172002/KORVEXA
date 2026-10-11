import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { BriefBuilder } from './brief-builder';

export const metadata: Metadata = { title: 'AI brief builder' };
export const dynamic = 'force-dynamic';

export default async function AiBriefPage() {
  const me = await serverGw('/me/briefs');
  if (me.status === 401) redirect('/login?next=/requests/new/ai');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI brief builder</h1>
        <p className="text-sm text-muted">
          Describe your idea in your own words. We ask a few questions, then draft a structured brief you can
          edit and post as a request.{' '}
          <Link className="text-primary underline-offset-4 hover:underline" href="/requests/new">
            Prefer to write it yourself?
          </Link>
        </p>
      </div>
      <BriefBuilder />
    </div>
  );
}
