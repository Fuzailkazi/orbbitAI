import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page numbers to show, with gaps for long ranges (same window as the model catalog). */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const ARROW_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-all hover:bg-muted active:scale-[0.98]";
const ARROW_DISABLED_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground opacity-50";

/**
 * Server-rendered pager for the evaluations list. Page state lives in the URL (`?page=`), so
 * every page is shareable and back/forward works. Renders nothing for a single page.
 */
export function EvaluationsPagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-mono tabular-nums">{first}</span>–
        <span className="font-mono tabular-nums">{last}</span> of{" "}
        <span className="font-mono tabular-nums">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Previous page" className={ARROW_CLASS}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-hidden className={ARROW_DISABLED_CLASS}>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="w-6 text-center text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              aria-current={page === p ? "page" : undefined}
              aria-label={`Page ${p}`}
              className={cn(
                "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-sm font-medium tabular-nums transition-all active:scale-[0.98]",
                page === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border text-foreground hover:bg-muted"
              )}
            >
              {p}
            </Link>
          )
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label="Next page" className={ARROW_CLASS}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-hidden className={ARROW_DISABLED_CLASS}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
