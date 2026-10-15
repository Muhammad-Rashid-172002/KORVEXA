/* eslint-disable @next/next/no-img-element -- presigned storage URLs are short-lived and not optimisable by next/image */
import { brand } from '@glasswork/shared/brand';
import type { ServiceCardView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
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
        {s.imageUrl ? (
          <img src={s.imageUrl} alt="" className="aspect-video w-full rounded-t-xl object-cover" />
        ) : (
          <ServiceCover
            category={s.category.slug}
            seed={s.slug}
            className="aspect-video w-full rounded-t-xl"
          />
        )}
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {s.seller.displayName} · {s.category.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={s.trust.avgRating} count={s.trust.reviewCount || undefined} />
            {s.trust.level !== 'new' && <LevelBadge level={s.trust.level} label={s.trust.levelLabel} />}
            {s.trust.verified && <Badge className="border-success/50 text-success">Verified</Badge>}
          </div>
          <h3 className="line-clamp-2 text-sm font-medium">{s.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm font-semibold tabular-nums">From {money(s.fromPrice, s.currency)}</span>
            <span className="text-muted">· {s.minDeliveryDays}-day delivery</span>
            {s.operatedByPlatform && <Badge>Operated by {brand.parentName}</Badge>}
            {s.isDemo && (
              <Badge
                className="border-warning/50 text-warning"
                title="Seeded development data, not a real listing"
              >
                Demo
              </Badge>
            )}
          </div>
        </div>
      </Link>
      {showFavorite && <FavoriteButton serviceId={s.id} title={s.title} />}
    </Card>
  );
}
