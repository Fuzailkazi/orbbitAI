import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40 bg-[#1F2937]" />
        <Skeleton className="mt-2 h-4 w-64 bg-[#1F2937]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-[#1F2937]" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl bg-[#1F2937]" />
    </div>
  );
}
