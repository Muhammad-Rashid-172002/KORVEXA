/* eslint-disable @next/next/no-img-element -- presigned storage URLs are short-lived and not optimisable by next/image */
import { brand } from '@glasswork/shared/brand';
import type { ServiceDetailView } from '@glasswork/shared';
import { Avatar } from '@glasswork/ui/components/avatar';
import { Badge } from '@glasswork/ui/components/badge';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FavoriteButton } from '@/components/favorite-button';
import { MessageSellerButton } from '@/components/message-seller-button';
import { ReportButton } from '@/components/report-button';
import { ServiceCover } from '@/components/service-cover';
import { LevelBadge, Stars } from '@/components/trust';
import { OrderPanel } from './order-panel';
import { WEB_URL } from '@/lib/config';
import { publicGw } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

const load = async (slug: string) =>
  (await publicGw<ServiceDetailView>(`/services/${encodeURIComponent(slug)}`)).data;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await load((await params).slug);
  if (!s) return { title: 'Service not found' };
  return {
    title: s.title,
    description: s.description.slice(0, 155),
    alternates: { canonical: `${WEB_URL}/services/${s.slug}` },
    openGraph: { title: s.title, description: s.description.slice(0, 155), type: 'website' },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = await load((await params).slug);
  if (!s) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.title,
    description: s.description,
    url: `${WEB_URL}/services/${s.slug}`,
    category: s.category.name,
    provider: {
      '@type': 'Person',
      name: s.seller.displayName,
      ...(s.seller.slug && { url: `${WEB_URL}/u/${s.seller.slug}` }),
    },
    offers: s.packages.map((p) => ({
      '@type': 'Offer',
      name: p.title,
      description: p.description,
      price: (p.priceAmount / 100).toFixed(2),
      priceCurrency: s.currency,
    })),
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_22rem]">
      <script
        type="application/ld+json"
        // Escape "<" so stored text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs text-muted">
            <Link href={`/services?category=${s.category.slug}`} className="hover:underline">
              {s.category.name}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            by{' '}
            {s.seller.slug ? (
              <Link className="text-primary underline-offset-4 hover:underline" href={`/u/${s.seller.slug}`}>
                {s.seller.displayName}
              </Link>
            ) : (
              s.seller.displayName
            )}
            {s.operatedByPlatform && <Badge>Operated by {brand.parentName}</Badge>}
            {s.isDemo && <Badge className="border-warning/50 text-warning">Demo listing</Badge>}
          </p>
        </div>

        {s.images.length === 0 && (
          <ServiceCover
            category={s.category.slug}
            seed={s.slug}
            title={s.title}
            seller={s.seller.displayName}
            className="aspect-video w-full rounded-xl"
          />
        )}

        {s.images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {s.images.map((i) =>
              i.url ? (
                <img key={i.fileId} src={i.url} alt={`${s.title} preview`} className="rounded-xl" />
              ) : null,
            )}
          </div>
        )}

        <section aria-labelledby="about" className="flex flex-col gap-2">
          <h2 id="about" className="text-lg font-semibold">
            About this service
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.description}</p>
        </section>

        <section
          aria-labelledby="seller"
          className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4"
        >
          <Avatar name={s.seller.displayName} src={s.seller.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id="seller" className="text-base font-semibold">
              About the seller
            </h2>
            <p className="text-sm">{s.seller.displayName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Stars value={s.trust.avgRating} count={s.trust.reviewCount || undefined} />
              {s.trust.level !== 'new' && <LevelBadge level={s.trust.level} label={s.trust.levelLabel} />}
              {s.trust.verified && <Badge className="border-success/50 text-success">Verified</Badge>}
            </div>
          </div>
          {s.seller.slug && (
            <Link
              className="text-sm text-primary underline-offset-4 hover:underline"
              href={`/u/${s.seller.slug}`}
            >
              View profile and reviews
            </Link>
          )}
        </section>

        {s.faqs.length > 0 && (
          <section aria-labelledby="faq" className="flex flex-col gap-3">
            <h2 id="faq" className="text-lg font-semibold">
              FAQ
            </h2>
            {s.faqs.map((f) => (
              <details key={f.id} className="rounded-md border border-border px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">{f.question}</summary>
                <p className="mt-2 text-sm text-muted">{f.answer}</p>
              </details>
            ))}
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label="Packages">
        <div className="relative h-8">
          <FavoriteButton serviceId={s.id} title={s.title} />
        </div>
        <MessageSellerButton sellerId={s.seller.id} next={`/services/${s.slug}`} />
        <ReportButton
          targetType="service"
          targetId={s.id}
          label="Report this service"
          next={`/services/${s.slug}`}
        />
        <OrderPanel service={s} />
      </aside>
    </div>
  );
}
