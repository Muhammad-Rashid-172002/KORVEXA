import { brand } from '@glasswork/shared/brand';
import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';

/** Placeholder home. The real landing page (3D hero) is Phase 8 — no fake stats or logos (brief §4.4). */
export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-24">
      <p className="rounded-full border border-border px-3 py-1 text-xs text-muted">
        Early preview · foundation build
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{brand.tagline}</h1>
      <p className="max-w-xl text-base text-muted">
        {brand.productName} is a marketplace for software projects where every milestone, deliverable and
        payment is visible to the buyer in one live project room.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Create an account</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </section>
  );
}
