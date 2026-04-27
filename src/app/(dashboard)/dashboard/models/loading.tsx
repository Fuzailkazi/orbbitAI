import { Skeleton } from "@/components/ui/skeleton";

export default function ModelsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-28 bg-slate-100" />
        <Skeleton className="mt-2 h-4 w-64 bg-slate-100" />
      </div>
      <Skeleton className="h-16 rounded-xl bg-slate-100" />
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-50">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-3.5">
              <Skeleton className="h-4 w-32 bg-slate-100" />
              <Skeleton className="h-4 w-20 bg-slate-100" />
              <Skeleton className="h-5 w-16 rounded-full bg-slate-100" />
              <Skeleton className="ml-auto h-4 w-12 bg-slate-100" />
              <Skeleton className="h-4 w-12 bg-slate-100" />
              <Skeleton className="h-4 w-16 bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
