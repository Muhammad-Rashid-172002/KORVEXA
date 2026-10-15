'use client';
import { Button } from '@glasswork/ui/components/button';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry's Next.js integration captures this automatically when a DSN is configured.
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <TriangleAlert className="size-10 text-warning" strokeWidth={1.4} aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted">
          This is on us. Try again, and if it keeps happening, contact support
          {error.digest ? ` with reference ${error.digest}` : ''}.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
