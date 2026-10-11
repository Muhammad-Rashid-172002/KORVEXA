import { nextLevelGap, SELLER_LEVELS, type ProfileView, type VerificationView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LevelBadge, Stars } from '@/components/trust';
import { serverGw } from '@/lib/server-gw';
import { VerificationForm } from './verification-form';

export const metadata: Metadata = { title: 'Trust & verification' };
export const dynamic = 'force-dynamic';

export default async function VerificationPage() {
  const [v, profile] = await Promise.all([
    serverGw<VerificationView[]>('/me/verifications'),
    serverGw<ProfileView>('/me/profile'),
  ]);
  if (v.status === 401) redirect('/login?next=/seller/verification');
  if (!v.data || !profile.data?.seller) redirect('/settings');
  const t = profile.data.seller.trust;
  const gap = nextLevelGap(t);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Trust &amp; verification</h1>

      <Card className="flex flex-col gap-3" data-testid="level-card">
        <CardTitle className="flex items-center gap-2">
          Your level <LevelBadge level={t.level} label={t.levelLabel} />
        </CardTitle>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Completed projects</dt>
            <dd>{t.completedProjects}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Public reviews</dt>
            <dd>{t.reviewCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Average rating</dt>
            <dd>
              <Stars value={t.avgRating} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">On-time delivery</dt>
            <dd>{t.onTimeRate === null ? '—' : `${Math.round(t.onTimeRate * 100)}%`}</dd>
          </div>
        </dl>
        {gap ? (
          <p className="text-sm text-muted" data-testid="level-gap">
            To reach <strong>{SELLER_LEVELS.find((l) => l.key === gap.next)!.label}</strong> you still need:{' '}
            {gap.missing.join(', ')}.
          </p>
        ) : (
          <p className="text-sm text-muted">You are at the highest level.</p>
        )}
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/seller-levels">
          How levels work
        </Link>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="badges">
        <h2 id="badges" className="text-lg font-semibold">
          Verification badges
        </h2>
        <p className="text-sm text-muted">
          Badges are shown on your profile only once an administrator has verified them.
        </p>
        <ul className="flex flex-col gap-3" data-testid="verification-list">
          {v.data.map((x) => (
            <li key={x.kind}>
              <Card className="flex flex-col gap-3" data-testid={`verification-${x.kind}`}>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{x.label}</CardTitle>
                  <Badge
                    className={x.status === 'verified' ? 'border-success/50 text-success' : ''}
                    data-testid="verification-status"
                  >
                    {x.status === ('none' as never) ? 'not requested' : x.status}
                    {x.automatic && ' (linked account)'}
                  </Badge>
                </div>
                {x.reviewNote && <p className="text-xs text-muted">Reviewer note: {x.reviewNote}</p>}
                {x.status !== 'verified' && x.status !== 'pending' && !x.automatic && (
                  <VerificationForm kind={x.kind} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
