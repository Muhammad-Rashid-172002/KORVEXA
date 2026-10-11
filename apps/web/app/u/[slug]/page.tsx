/* eslint-disable @next/next/no-img-element -- avatars/portfolio are short-lived presigned storage URLs, not optimisable by next/image */
import type { ProfileView, ReviewView, SellerStatsView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MessageSellerButton } from '@/components/message-seller-button';
import { ReportButton } from '@/components/report-button';
import { LevelBadge, Stars, VerifiedBadges } from '@/components/trust';
import { API_INTERNAL_URL } from '@/lib/config';
import { serverGw } from '@/lib/server-gw';
import { ReplyForm } from './reply-form';

async function load(slug: string) {
  const [p, r] = await Promise.all([
    fetch(`${API_INTERNAL_URL}/v1/profiles/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(
      () => null,
    ),
    fetch(`${API_INTERNAL_URL}/v1/profiles/${encodeURIComponent(slug)}/reviews?limit=20`, {
      cache: 'no-store',
    }).catch(() => null),
  ]);
  const profile = p?.ok ? ((await p.json()) as ProfileView) : null;
  const reviews = r?.ok ? ((await r.json()) as { stats: SellerStatsView; items: ReviewView[] }) : null;
  return { profile, reviews };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { profile } = await load((await params).slug);
  return profile
    ? { title: profile.displayName, description: profile.headline ?? undefined }
    : { title: 'Profile not found' };
}

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { profile: p, reviews } = await load((await params).slug);
  if (!p) notFound();
  const me = await serverGw<{ id: string }>('/me');
  const isOwner = me.data?.id === p.userId;
  const s = p.seller;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-4">
        {p.avatarUrl ? (
          <img src={p.avatarUrl} alt="" className="size-20 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-20 items-center justify-center rounded-full bg-surface-2 text-2xl"
            aria-hidden
          >
            {p.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.displayName}</h1>
          {p.headline && <p className="text-muted">{p.headline}</p>}
          <p className="text-xs text-muted">{[p.country, p.timezone].filter(Boolean).join(' · ')}</p>
          {s && (
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={s.trust.level} label={s.trust.levelLabel} />
              <Stars value={s.trust.avgRating} count={s.trust.reviewCount} />
            </div>
          )}
        </div>
      </div>
      {s && <VerifiedBadges badges={s.trust.badges} />}
      {p.bio && <p className="whitespace-pre-wrap text-sm">{p.bio}</p>}
      {!isOwner && (
        <div className="flex flex-wrap items-start gap-4">
          <MessageSellerButton sellerId={p.userId} next={`/u/${p.slug}`} />
          <ReportButton
            targetType="user"
            targetId={p.userId}
            label="Report this seller"
            next={`/u/${p.slug}`}
          />
        </div>
      )}
      {s && (
        <>
          <Card className="flex flex-col gap-3">
            <CardTitle>Seller</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge>{s.availability}</Badge>
              {s.hourlyRateAmount !== null && (
                <Badge>{money(s.hourlyRateAmount, s.rateCurrency)} / hour</Badge>
              )}
              {s.yearsExperience !== null && <Badge>{s.yearsExperience} yrs experience</Badge>}
              <Badge data-testid="completed-count">
                {s.trust.completedProjects} completed project{s.trust.completedProjects === 1 ? '' : 's'}
              </Badge>
              {s.trust.onTimeRate !== null && <Badge>{Math.round(s.trust.onTimeRate * 100)}% on time</Badge>}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Skills">
              {s.skills.map((k) => (
                <Badge key={k.slug}>{k.name}</Badge>
              ))}
            </div>
          </Card>

          <section className="flex flex-col gap-3" aria-labelledby="reviews" data-testid="reviews-section">
            <h2 id="reviews" className="text-lg font-semibold">
              Reviews
            </h2>
            {reviews && reviews.stats.reviewCount > 0 && (
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {(['communication', 'quality', 'timeliness'] as const).map((k) => (
                  <div key={k}>
                    <dt className="text-xs capitalize text-muted">{k}</dt>
                    <dd>
                      <Stars value={reviews.stats.subRatings[k]} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {!reviews || reviews.items.length === 0 ? (
              <p className="text-sm text-muted">
                No reviews yet. Reviews appear after a buyer completes a paid project.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {reviews.items.map((r) => (
                  <li key={r.id}>
                    <Card className="flex flex-col gap-2" data-testid="review">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium">{r.author.name}</span>
                        <Stars value={r.ratingOverall} />
                      </div>
                      <p className="text-xs text-muted">
                        {r.projectTitle} · {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                      {r.body && <p className="whitespace-pre-wrap text-sm">{r.body}</p>}
                      {r.reply ? (
                        <div className="rounded-md bg-surface-2 p-3 text-sm" data-testid="review-reply">
                          <p className="text-xs text-muted">Reply from {p.displayName}</p>
                          <p className="whitespace-pre-wrap">{r.reply.body}</p>
                        </div>
                      ) : (
                        isOwner && <ReplyForm reviewId={r.id} />
                      )}
                      {!isOwner && <ReportButton targetType="review" targetId={r.id} next={`/u/${p.slug}`} />}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {s.portfolio.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="pf">
              <h2 id="pf" className="text-lg font-semibold">
                Portfolio
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {s.portfolio.map((i) => (
                  <Card key={i.id} className="flex flex-col gap-2">
                    {i.imageUrl && <img src={i.imageUrl} alt={i.title} className="rounded-md" />}
                    <CardTitle>{i.title}</CardTitle>
                    {i.description && <p className="text-sm text-muted">{i.description}</p>}
                    {i.url && (
                      <a
                        href={i.url}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Visit project
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
