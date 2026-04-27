import { Skeleton } from "@/components/ui/skeleton";

export default function ModelDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28 bg-slate-100" />
      <div>
        <Skeleton className="h-8 w-48 bg-slate-100" />
        <Skeleton className="mt-2 h-4 w-64 bg-slate-100" />
      </div>
      <Skeleton className="h-16 rounded-xl bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
