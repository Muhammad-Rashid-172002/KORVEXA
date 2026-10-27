import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProsePage } from '@/components/marketing/prose-page';
import { HELP_ARTICLES, HELP_CATEGORIES, getHelpArticle } from '@/lib/help-content';

export const dynamicParams = false;
export const generateStaticParams = () => HELP_ARTICLES.map((a) => ({ slug: a.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = getHelpArticle((await params).slug);
  return a ? { title: a.title, description: a.summary } : {};
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getHelpArticle((await params).slug);
  if (!a) notFound();
  const cat = HELP_CATEGORIES.find((c) => c.key === a.category)!;
  const related = HELP_ARTICLES.filter((x) => x.category === a.category && x.slug !== a.slug).slice(0, 4);
  return (
    <ProsePage eyebrow={cat.label} title={a.title} description={a.summary}>
      <nav aria-label="Breadcrumb" className="-mt-6 text-sm text-muted">
        <Link href="/help">Help center</Link> / {cat.label}
      </nav>
      {a.sections.map((s, i) => (
        <section key={i} className="space-y-3 text-sm leading-relaxed text-muted sm:text-base">
          {s.heading && <h2 className="text-lg font-semibold tracking-tight text-fg">{s.heading}</h2>}
          {s.body?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.steps && (
            <ol className="list-decimal space-y-2 pl-5 marker:text-primary">
              {s.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          )}
          {s.bullets && (
            <ul className="list-disc space-y-2 pl-5 marker:text-primary">
              {s.bullets.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {related.length > 0 && (
        <section aria-labelledby="related" className="border-t border-border pt-6">
          <h2 id="related" className="text-lg font-semibold tracking-tight">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/help/${r.slug}`}>{r.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ProsePage>
  );
}
