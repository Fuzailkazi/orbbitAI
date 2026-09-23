import { Skeleton } from "@/components/ui/skeleton";

export default function EvaluateLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading evaluation runner">
      <div>
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="mt-3 h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
