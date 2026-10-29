/* eslint-disable @next/next/no-img-element -- local blob / presigned URLs */
'use client';
import { Avatar } from '@glasswork/ui/components/avatar';
import { Card } from '@glasswork/ui/components/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@glasswork/ui/components/tabs';
import { Star } from 'lucide-react';
import { ServiceCover } from '@/components/service-cover';

export interface PreviewData {
  title: string;
  categorySlug: string;
  sellerName: string;
  coverUrl: string | null;
  fromPrice: number | null;
  minDays: number | null;
  description: string;
  packages: { tier: string; title: string; price: number | null; days: number | null }[];
  faqCount: number;
  imageCount: number;
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/** What buyers will see: the gig card (search results) and a compact version of the gig page. */
export function GigPreview({ d }: { d: PreviewData }) {
  const title = d.title.trim() || 'I will … (your title appears here)';
  const cover = d.coverUrl ? (
    <img src={d.coverUrl} alt="Your cover image" className="aspect-video w-full object-cover" />
  ) : (
    <ServiceCover
      category={d.categorySlug}
      seed={d.title || 'preview'}
      title={title}
      seller={d.sellerName}
      className="aspect-video w-full"
    />
  );
  return (
    <div className="flex flex-col gap-2" data-testid="gig-preview">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Live preview</p>
      <Tabs defaultValue="card">
        <TabsList>
          <TabsTrigger value="card">Gig card</TabsTrigger>
          <TabsTrigger value="page">Gig page</TabsTrigger>
        </TabsList>
        <TabsContent value="card">
          <Card className="flex flex-col gap-3 overflow-hidden p-0">
            {cover}
            <div className="flex flex-col gap-2 px-4 pb-4">
              <div className="flex items-center gap-2">
                <Avatar name={d.sellerName} size="sm" />
                <p className="truncate text-sm font-medium">{d.sellerName}</p>
              </div>
              <h3 className="line-clamp-2 min-h-10 text-sm leading-5">{title}</h3>
              <p className="flex items-center gap-1 text-xs text-muted">
                <Star size={12} aria-hidden /> New, no reviews yet
              </p>
              <div className="flex items-end justify-between border-t border-border pt-2">
                <span className="text-xs text-muted">
                  {d.minDays ? `${d.minDays}-day delivery` : 'Delivery time'}
                </span>
                <span className="text-xs text-muted">
                  Starting at{' '}
                  <span className="text-base font-semibold text-fg">
                    {d.fromPrice ? usd(d.fromPrice) : '$—'}
                  </span>
                </span>
              </div>
            </div>
          </Card>
          {!d.coverUrl && (
            <p className="mt-2 text-xs text-warning">
              Auto-generated cover. Upload your own image so buyers see your real work.
            </p>
          )}
        </TabsContent>
        <TabsContent value="page">
          <Card className="flex flex-col gap-3 overflow-hidden p-0">
            {cover}
            <div className="flex flex-col gap-3 px-4 pb-4">
              <h3 className="text-base font-semibold leading-snug">{title}</h3>
              <p className="line-clamp-4 whitespace-pre-line text-xs text-muted">
                {d.description.trim() || 'Your description appears here.'}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {d.packages.map((p) => (
                  <div key={p.tier} className="rounded-lg border border-border p-2">
                    <p className="font-medium capitalize">{p.tier}</p>
                    <p className="mt-1 text-base font-semibold">{p.price ? usd(p.price) : '$—'}</p>
                    <p className="text-muted">{p.days ? `${p.days} days` : '— days'}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">
                {d.imageCount} image{d.imageCount === 1 ? '' : 's'} · {d.faqCount} FAQ
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
