import { Button } from '@glasswork/ui/components/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-24">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <Button asChild variant="secondary">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
