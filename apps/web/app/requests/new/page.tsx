import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { NewRequestForm } from './new-request-form';

export const metadata: Metadata = { title: 'Post a request' };
export const dynamic = 'force-dynamic';

export default async function NewRequestPage() {
  const me = await serverGw('/me/briefs');
  if (me.status === 401) redirect('/login?next=/requests/new');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post a request</h1>
        <p className="text-sm text-muted">
          Describe what you need. Sellers reply with a plan, milestones and a price.
        </p>
        <p className="mt-2 text-sm">
          Not sure how to describe it?{' '}
          <Link className="text-primary underline-offset-4 hover:underline" href="/requests/new/ai">
            Let the AI brief builder help
          </Link>
          .
        </p>
      </div>
      <NewRequestForm />
    </div>
  );
}
