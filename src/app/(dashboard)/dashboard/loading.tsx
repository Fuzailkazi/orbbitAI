import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the overview's layout (same container, grid breakpoints, card chrome and section heights)
 * so content swaps in without the page jumping.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16 sm:space-y-8" aria-busy>
      {/* 1. Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Skeleton className="h-8 w-36" />
          {/* Same line boxes as the text-sm subtitle (20px each; it wraps to two lines on phones). */}
          <div className="mt-1 flex flex-col">
            <Skeleton className="my-0.5 h-4 w-[37rem] max-w-full" />
            <Skeleton className="my-0.5 h-4 w-2/3 sm:hidden" />
          </div>
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* 2. Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* 3. Charts */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-16 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-[30px] w-36 rounded-lg" />
            </div>
            <div className="space-y-2 pt-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-[78px] rounded-xl sm:h-[54px]" />
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mb-4 h-3 rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* 4. Benchmark suites */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
          <Skeleton className="mb-4 h-7 w-52" />
          <div className="divide-y divide-border">
            <div className="py-3">
              <Skeleton className="h-4 w-full" />
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="py-3">
                <Skeleton className="h-[22px] w-full" />
              </div>
            ))}
          </div>
        </section>

        {/* 5. Recent evaluations */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-14" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] rounded-lg" />
            ))}
          </div>
        </section>
      </div>

      {/* 6. Quick actions */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
