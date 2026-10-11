/* eslint-disable @next/next/no-img-element -- avatars/portfolio are short-lived presigned storage URLs, not optimisable by next/image */
import type { ProfileView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_INTERNAL_URL } from '@/lib/config';

async function load(slug: string): Promise<ProfileView | null> {
  const res = await fetch(`${API_INTERNAL_URL}/v1/profiles/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  }).catch(() => null);
  return res?.ok ? ((await res.json()) as ProfileView) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.displayName, description: p.headline ?? undefined } : { title: 'Profile not found' };
}

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.displayName}</h1>
          {p.headline && <p className="text-muted">{p.headline}</p>}
          <p className="text-xs text-muted">{[p.country, p.timezone].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {p.bio && <p className="whitespace-pre-wrap text-sm">{p.bio}</p>}
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
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Skills">
              {s.skills.map((k) => (
                <Badge key={k.slug}>{k.name}</Badge>
              ))}
            </div>
          </Card>
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
