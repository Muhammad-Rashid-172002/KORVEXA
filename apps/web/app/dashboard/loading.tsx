import { Skeleton } from '@glasswork/ui/components/skeleton';

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
