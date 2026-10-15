import { Button } from '@glasswork/ui/components/button';
import { Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-hero-glow flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Compass className="size-10 text-primary" strokeWidth={1.4} aria-hidden />
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">We could not find that page</h1>
        <p className="text-sm text-muted">
          It may have moved, or you may not have access to it. Check the address, or head back to the
          marketplace.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/services">Browse services</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
