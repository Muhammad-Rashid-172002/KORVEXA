import { PageHeader } from '@glasswork/ui/components/page-header';
import type { ReactNode } from 'react';

/** Shared shell for text-led marketing pages: heading, then readable 720px column. */
export function ProsePage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-hero-glow">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </div>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted sm:text-base">{children}</div>
    </section>
  );
}
