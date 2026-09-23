import { Skeleton } from "@/components/ui/skeleton";
export default function CompareLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-44" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
