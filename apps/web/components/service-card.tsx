/* eslint-disable @next/next/no-img-element -- presigned storage URLs are short-lived and not optimisable by next/image */
import { brand } from '@glasswork/shared/brand';
import type { ServiceCardView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { money } from '@/lib/format';
import { FavoriteButton } from './favorite-button';

export function ServiceCard({ s, showFavorite = true }: { s: ServiceCardView; showFavorite?: boolean }) {
  return (
    <Card className="relative flex flex-col gap-3 p-0" data-testid="service-card">
      <Link href={`/services/${s.slug}`} className="flex flex-col gap-3">
        {s.imageUrl ? (
          <img src={s.imageUrl} alt="" className="aspect-video w-full rounded-t-xl object-cover" />
        ) : (
          <div className="aspect-video w-full rounded-t-xl bg-surface-2" aria-hidden />
        )}
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-xs text-muted">
            {s.seller.displayName} · {s.category.name}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium">{s.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm font-semibold tabular-nums">From {money(s.fromPrice, s.currency)}</span>
            <span className="text-muted">· {s.minDeliveryDays}-day delivery</span>
            {s.operatedByPlatform && <Badge>Operated by {brand.parentName}</Badge>}
          </div>
        </div>
      </Link>
      {showFavorite && <FavoriteButton serviceId={s.id} title={s.title} />}
    </Card>
  );
}
