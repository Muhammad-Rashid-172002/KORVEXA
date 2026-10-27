import { Alert } from '@glasswork/ui/components/alert';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Block, ProsePage } from '@/components/marketing/prose-page';
import { getLegalDoc, LEGAL_DOCS } from '@/lib/legal-content';

export const dynamicParams = false;
export const generateStaticParams = () => LEGAL_DOCS.map((d) => ({ doc: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const doc = getLegalDoc((await params).doc);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = getLegalDoc((await params).doc);
  if (!doc) notFound();
  return (
    <ProsePage eyebrow="Legal" title={doc.title} description={doc.summary}>
      <Alert data-testid="legal-draft-notice">
        <strong>Draft pending lawyer review.</strong> This document is not final and is not legal advice. The
        operating entity details will be completed before launch.
      </Alert>
      {doc.sections.map((s) => (
        <Block key={s.heading} title={s.heading}>
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Block>
      ))}
      <nav
        aria-label="Other legal documents"
        className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6 text-sm"
      >
        {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
          <Link key={d.slug} className="text-muted hover:text-primary" href={`/legal/${d.slug}`}>
            {d.title}
          </Link>
        ))}
      </nav>
    </ProsePage>
  );
}
