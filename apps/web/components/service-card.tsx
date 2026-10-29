/* eslint-disable @next/next/no-img-element -- presigned storage URLs are short-lived and not optimisable by next/image */
import { brand } from '@glasswork/shared/brand';
import type { ServiceCardView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Avatar } from '@glasswork/ui/components/avatar';
import { Card } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { money } from '@/lib/format';
import { FavoriteButton } from './favorite-button';
import { ServiceCover } from './service-cover';
import { LevelBadge, Stars } from './trust';

export function ServiceCard({ s, showFavorite = true }: { s: ServiceCardView; showFavorite?: boolean }) {
  return (
    <Card className="card-lift relative flex flex-col gap-3 p-0" data-testid="service-card">
      <Link href={`/services/${s.slug}`} className="flex flex-col gap-3">
        <div className="relative">
          {s.imageUrl ? (
            <img src={s.imageUrl} alt="" className="aspect-video w-full rounded-t-xl object-cover" />
          ) : (
            <ServiceCover
              category={s.category.slug}
              seed={s.slug}
              title={s.title}
              seller={s.seller.displayName}
              className="aspect-video w-full rounded-t-xl"
            />
          )}
          {s.isDemo && (
            <Badge
              className="absolute left-2 top-2 border-warning/50 bg-bg/80 text-warning"
              title="Seeded development data, not a real listing"
            >
              Demo
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="flex items-center gap-2">
            <Avatar name={s.seller.displayName} src={s.seller.avatarUrl} size="sm" />
            <p className="truncate text-sm font-medium">{s.seller.displayName}</p>
            {s.trust.level !== 'new' && <LevelBadge level={s.trust.level} label={s.trust.levelLabel} />}
          </div>
          <h3 className="line-clamp-2 min-h-10 text-sm leading-5">{s.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {s.trust.reviewCount > 0 ? (
              <Stars value={s.trust.avgRating} count={s.trust.reviewCount || undefined} />
            ) : (
              <span className="text-xs text-muted">New, no reviews yet</span>
            )}
            {s.trust.verified && <Badge className="border-success/50 text-success">Verified</Badge>}
          </div>
          <div className="flex items-end justify-between gap-2 border-t border-border pt-2">
            <span className="text-xs text-muted">{s.minDeliveryDays}-day delivery</span>
            <span className="text-right text-xs text-muted">
              Starting at{' '}
              <span className="text-base font-semibold tabular-nums text-fg">
                {money(s.fromPrice, s.currency)}
              </span>
            </span>
          </div>
          {s.operatedByPlatform && <Badge className="self-start">Operated by {brand.parentName}</Badge>}
        </div>
      </Link>
      {showFavorite && <FavoriteButton serviceId={s.id} title={s.title} />}
    </Card>
  );
}
