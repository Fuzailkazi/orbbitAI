import { Skeleton } from "@/components/ui/skeleton";
export default function LeaderboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-36 bg-slate-100" />
      <Skeleton className="h-40 rounded-xl bg-slate-100" />
      <Skeleton className="h-96 rounded-xl bg-slate-100" />
    </div>
  );
}
