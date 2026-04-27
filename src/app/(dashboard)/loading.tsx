import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-4 w-24 bg-slate-100" />
            <Skeleton className="mt-3 h-9 w-20 bg-slate-100" />
            <Skeleton className="mt-3 h-3 w-32 bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl bg-slate-100 lg:col-span-2" />
        <div className="space-y-6">
          <Skeleton className="h-44 rounded-xl bg-slate-100" />
          <Skeleton className="h-32 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
