import type { BriefView } from '@glasswork/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { MatchForm } from './match-form';

export const metadata: Metadata = { title: 'Find sellers' };
export const dynamic = 'force-dynamic';

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ briefId?: string }> }) {
  const { briefId } = await searchParams;
  const mine = await serverGw<BriefView[]>('/me/briefs');
  if (mine.status === 401) redirect('/login?next=/match');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find sellers</h1>
        <p className="text-sm text-muted">
          Describe your project or pick one of your requests. Sellers are ranked using real data: skills,
          reviews, verifications, reply speed, availability and budget fit. Each match explains why.
        </p>
      </div>
      <MatchForm
        briefs={(mine.data ?? [])
          .filter((b) => b.status === 'open')
          .map((b) => ({ id: b.id, title: b.title }))}
        initialBriefId={briefId}
      />
    </div>
  );
}
