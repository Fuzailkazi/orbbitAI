import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-32 bg-[#1F2937]" />
        <Skeleton className="mt-2 h-4 w-72 bg-[#1F2937]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#1E293B]/60 bg-[#111827]/80 p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-20 bg-[#1F2937]" />
                <Skeleton className="h-8 w-16 bg-[#1F2937]" />
                <Skeleton className="h-3 w-24 bg-[#1F2937]" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg bg-[#1F2937]" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-64 rounded-xl bg-[#1F2937] lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl bg-[#1F2937] lg:col-span-3" />
      </div>
    </div>
  );
}
