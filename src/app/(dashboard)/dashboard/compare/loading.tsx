import { Skeleton } from "@/components/ui/skeleton";
export default function CompareLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-44 bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl bg-slate-100" />
        <Skeleton className="h-24 rounded-xl bg-slate-100" />
      </div>
      <Skeleton className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
