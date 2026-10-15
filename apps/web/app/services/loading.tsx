import { Skeleton } from '@glasswork/ui/components/skeleton';

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10"
      aria-busy="true"
      aria-label="Loading services"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
