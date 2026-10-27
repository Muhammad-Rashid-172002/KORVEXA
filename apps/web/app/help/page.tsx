import { brand } from '@glasswork/shared/brand';
import { Card } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/marketing/prose-page';
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help-content';

export const metadata: Metadata = {
  title: 'Help center',
  description:
    'Guides for buyers and sellers: projects, milestones, escrow, disputes, levels and your account.',
};

export default function HelpPage() {
  return (
    <ProsePage
      eyebrow="Help center"
      title="How can we help?"
      description={`Short, practical guides for buying and selling software work on ${brand.productName}.`}
    >
      {HELP_CATEGORIES.map((c) => (
        <section key={c.key} aria-labelledby={`cat-${c.key}`}>
          <h2 id={`cat-${c.key}`} className="text-xl font-semibold tracking-tight">
            {c.label}
          </h2>
          <p className="mt-1 text-sm text-muted">{c.blurb}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {HELP_ARTICLES.filter((a) => a.category === c.key).map((a) => (
              <li key={a.slug}>
                <Link href={`/help/${a.slug}`} className="no-underline block h-full">
                  <Card className="h-full transition-colors hover:border-primary/60">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-1 text-sm text-muted">{a.summary}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted">
        Cannot find an answer? Visit the <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}
