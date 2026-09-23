import { Skeleton } from "@/components/ui/skeleton";

export default function EvaluationsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading evaluations">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-6 w-28 rounded-full sm:block" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-6 border-b border-border px-5 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="hidden h-4 w-14 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
