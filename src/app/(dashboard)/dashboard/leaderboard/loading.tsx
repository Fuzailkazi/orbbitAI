import { Skeleton } from "@/components/ui/skeleton";
export default function LeaderboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
