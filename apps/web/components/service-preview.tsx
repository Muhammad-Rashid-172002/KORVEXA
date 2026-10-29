/* eslint-disable @next/next/no-img-element -- presigned storage URLs */
import type { ServiceDetailView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { ReactNode } from 'react';
import { money } from '@/lib/format';
import { ServiceCover } from './service-cover';

const STATUS_TEXT: Record<string, string> = {
  draft: 'Draft. Not submitted yet.',
  pending_review: 'Submitted for review. Our team will check it, usually within a day.',
  live: 'Live. Buyers can find and order it.',
  rejected: 'Needs changes before it can go online.',
  paused: 'Paused. Hidden from buyers.',
};

/** The gig as buyers will see it, for the owner (any status) and for moderating admins. Not an indexed page. */
export function ServicePreview({
  s,
  banner,
  actions,
}: {
  s: ServiceDetailView;
  banner: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8" data-testid="service-preview">
      <Alert tone={s.status === 'pending_review' ? 'success' : 'info'} data-testid="preview-banner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              {banner} <Badge data-testid="preview-status">{s.status.replace('_', ' ')}</Badge>
            </p>
            <p className="text-sm text-muted">{STATUS_TEXT[s.status]}</p>
            {s.status === 'rejected' && s.rejectionReason && (
              <p className="text-sm">Reason: {s.rejectionReason}</p>
            )}
          </div>
          {actions}
        </div>
      </Alert>

      <div>
        <p className="text-xs text-muted">{s.category.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
        <p className="mt-1 text-sm text-muted">by {s.seller.displayName}</p>
      </div>

      {s.images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {s.images.map((im, i) =>
            im.url ? (
              <img
                key={im.fileId}
                src={im.url}
                alt={`Gallery image ${i + 1}`}
                className="aspect-video w-full rounded-xl object-cover"
              />
            ) : (
              <div
                key={im.fileId}
                className="flex aspect-video items-center justify-center rounded-xl bg-surface-2 text-sm text-muted"
              >
                Image is being checked
              </div>
            ),
          )}
        </div>
      ) : (
        <div>
          <ServiceCover
            category={s.category.slug}
            seed={s.slug}
            title={s.title}
            seller={s.seller.displayName}
            className="aspect-video w-full rounded-xl"
          />
          <p className="mt-1 text-xs text-warning">
            Auto-generated cover. Add your own image to get more orders.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">About this service</h2>
        <p className="mt-2 whitespace-pre-line text-sm">{s.description}</p>
        {s.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-2">
            {s.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Packages">
        {s.packages.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2" data-testid={`preview-package-${p.tier}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{p.tier}</p>
            <CardTitle>{p.title}</CardTitle>
            <p className="text-2xl font-semibold">{money(p.priceAmount, s.currency)}</p>
            <p className="text-sm text-muted">{p.description}</p>
            <p className="text-xs text-muted">
              {p.deliveryDays}-day delivery · {p.revisions} change{p.revisions === 1 ? '' : 's'}
            </p>
          </Card>
        ))}
      </section>

      {s.extras.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Extras</h2>
          <ul className="mt-2 text-sm">
            {s.extras.map((e) => (
              <li key={e.id}>
                {e.title}: {money(e.priceAmount, s.currency)}
                {e.extraDays ? ` (+${e.extraDays} days)` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.requirementsForm.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">What the buyer tells you</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {s.requirementsForm.map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </section>
      )}

      {s.faqs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Frequently asked questions</h2>
          <div className="mt-2 divide-y divide-border rounded-xl border border-border">
            {s.faqs.map((f) => (
              <details key={f.id} className="px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">{f.question}</summary>
                <p className="mt-2 text-sm text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
