import { Skeleton } from "@/components/ui/skeleton";

export default function ModelsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <div className="rounded-2xl border border-border bg-card shadow-xs">
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-3.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="ml-auto h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
