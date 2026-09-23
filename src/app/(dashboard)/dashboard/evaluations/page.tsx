import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STALLED_RUN_MESSAGE, settleStalledEvaluations } from "@/lib/eval/stalled";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import {
  formatLatency,
  formatModelName,
  formatNumber,
  formatVendor,
  resolveCI,
  scoredQuestionCount,
} from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";
import type { Benchmark, Evaluation, EvaluationStatus, Model } from "@/types/database";
import { EvaluationsPagination } from "./evaluations-pagination";

export const metadata: Metadata = {
  title: "Evaluations",
};

type EvaluationListRow = Pick<
  Evaluation,
  | "id"
  | "status"
  | "accuracy"
  | "accuracy_ci_lower"
  | "accuracy_ci_upper"
  | "questions_evaluated"
  | "questions_correct"
  | "failure_rate"
  | "avg_latency_ms"
  | "tokens_per_second"
  | "started_at"
  | "completed_at"
  | "created_at"
> & {
  models: Pick<Model, "id" | "name" | "vendor"> | null;
  benchmarks: Pick<Benchmark, "id" | "name" | "category"> | null;
};

/** DB status plus the derived "stalled" state (a run whose request died before finalizing). */
type DisplayStatus = EvaluationStatus | "stalled";

const STATUS_STYLES: Record<DisplayStatus, { label: string; className: string; dot: string }> = {
  completed: {
    label: "Completed",
    className: "border-success/20 bg-success/10 text-success",
    dot: "bg-success",
  },
  running: {
    label: "Running",
    className: "border-brand/20 bg-brand/10 text-brand",
    dot: "bg-brand animate-pulse",
  },
  pending: {
    label: "Pending",
    className: "border-warning/20 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  failed: {
    label: "Failed",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  stalled: {
    label: "Stalled",
    className: "border-warning/20 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
};

/** In-flight runs first, then completed by accuracy, then failed/cancelled. */
const STATUS_ORDER: Record<DisplayStatus, number> = {
  running: 0,
  pending: 1,
  completed: 2,
  stalled: 3,
  failed: 3,
  cancelled: 4,
};

function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span
      title={status === "stalled" ? STALLED_RUN_MESSAGE : undefined}
      className={cn(
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium",
        s.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/** Rows per page. Only the current page is rendered, so the HTML stays small as runs pile up. */
const PAGE_SIZE = 25;

/** URL for a filter + page combination (page 1 is the bare URL, so filter links reset paging). */
function filterHref(benchmark: string | null, page = 1) {
  const query = new URLSearchParams();
  if (benchmark) query.set("benchmark", benchmark);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/dashboard/evaluations?${qs}` : "/dashboard/evaluations";
}

/** Positive integer page from the URL; anything else is page 1. */
function parsePage(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const benchmarkParam = typeof params.benchmark === "string" ? params.benchmark : null;
  const requestedPage = parsePage(params.page);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, status, accuracy, accuracy_ci_lower, accuracy_ci_upper, questions_evaluated, questions_correct, failure_rate, avg_latency_ms, tokens_per_second, started_at, completed_at, created_at, models(id, name, vendor), benchmarks(id, name, category)"
    )
    .order("accuracy", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load evaluations: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as EvaluationListRow[];

  // Runs stuck in "running" past the function limit were killed before finalizing. They are
  // closed as failed by a server-side update scoped to those row ids and status = 'running'
  // (a completed row is never touched — rule 5) and shown with a Stalled badge.
  const stalledIds = await settleStalledEvaluations(rows, createAdminClient);
  const displayStatusOf = (ev: EvaluationListRow): DisplayStatus =>
    stalledIds.has(ev.id) ? "stalled" : ev.status;

  const all = rows
    .map((ev) => ({ ...ev, displayStatus: displayStatusOf(ev) }))
    .sort((a, b) => (STATUS_ORDER[a.displayStatus] ?? 9) - (STATUS_ORDER[b.displayStatus] ?? 9));

  const benchmarkCounts = new Map<string, number>();
  for (const ev of all) {
    const name = ev.benchmarks?.name;
    if (name) benchmarkCounts.set(name, (benchmarkCounts.get(name) ?? 0) + 1);
  }
  const benchmarkNames = [...benchmarkCounts.keys()].sort((a, b) => a.localeCompare(b));
  const activeBenchmark =
    benchmarkParam && benchmarkCounts.has(benchmarkParam) ? benchmarkParam : null;

  const evals = activeBenchmark
    ? all.filter((ev) => ev.benchmarks?.name === activeBenchmark)
    : all;

  // Status counts and filter tallies cover every run; only the current page is rendered.
  const totalPages = Math.max(1, Math.ceil(evals.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = evals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = all.reduce<Partial<Record<DisplayStatus, number>>>((acc, ev) => {
    acc[ev.displayStatus] = (acc[ev.displayStatus] ?? 0) + 1;
    return acc;
  }, {});
  const inFlight = (statusCounts.running ?? 0) + (statusCounts.pending ?? 0);
  // Stalled runs end as failed, so they count toward the failed total.
  const failedTotal = (statusCounts.failed ?? 0) + (statusCounts.stalled ?? 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evaluations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every run across models and benchmarks. Select a score to inspect it prompt by prompt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 font-mono text-xs font-medium tabular-nums text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {formatNumber(statusCounts.completed ?? 0)} completed
          </span>
          {inFlight > 0 && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 font-mono text-xs font-medium tabular-nums text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              {formatNumber(inFlight)} in progress
            </span>
          )}
          {failedTotal > 0 && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 font-mono text-xs font-medium tabular-nums text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {formatNumber(failedTotal)} failed
            </span>
          )}
        </div>
      </div>

      {/* Benchmark filter (URL state) */}
      {benchmarkNames.length > 1 && (
        <nav
          aria-label="Filter by benchmark"
          className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1.5 shadow-sm [scrollbar-width:none]"
        >
          <Link
            href={filterHref(null)}
            aria-current={activeBenchmark === null ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeBenchmark === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            All <span className="font-mono tabular-nums opacity-70">{all.length}</span>
          </Link>
          {benchmarkNames.map((name) => {
            const active = activeBenchmark === name;
            return (
              <Link
                key={name}
                href={filterHref(name)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {name}{" "}
                <span className="font-mono tabular-nums opacity-70">{benchmarkCounts.get(name)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {evals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">No evaluations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Run a benchmark against any model and the results will appear here.
          </p>
          <Link
            href="/dashboard/evaluate"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Run evaluation
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Model</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Benchmark</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Accuracy <span className="normal-case tracking-normal">(95% CI)</span>
                    </th>
                    <th className="hidden px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Questions</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Avg latency</th>
                    <th className="hidden px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Tokens/s</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((ev) => {
                    const ci = resolveCI(ev);
                    const href = `/dashboard/evaluations/${ev.id}`;
                    return (
                      <tr key={ev.id} className="group transition-colors hover:bg-muted/50">
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: getVendorColor(ev.models?.vendor) }}
                            />
                            <div className="min-w-0">
                              {ev.models ? (
                                <Link
                                  href={`/dashboard/models/${ev.models.id}`}
                                  className="block truncate text-sm font-medium text-foreground transition-colors hover:text-brand"
                                >
                                  {formatModelName(ev.models.name)}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium text-muted-foreground">Unknown model</span>
                              )}
                              <p className="text-xs text-muted-foreground">{formatVendor(ev.models?.vendor)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-foreground">{ev.benchmarks?.name ?? "Unknown"}</p>
                          <p className="text-xs capitalize text-muted-foreground">{ev.benchmarks?.category}</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {ev.status === "completed" ? (
                            <Link href={href} className="rounded-md transition-opacity hover:opacity-70" aria-label="Open prompt-level results">
                              <AccuracyWithCI
                                accuracy={ci.accuracy}
                                lower={ci.lower}
                                upper={ci.upper}
                                ciFormat="range"
                              />
                            </Link>
                          ) : (
                            <StatusBadge status={ev.displayStatus} />
                          )}
                        </td>
                        <td className="hidden px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground lg:table-cell">
                          {ev.questions_evaluated > 0
                            ? `${formatNumber(ev.questions_correct)}/${formatNumber(scoredQuestionCount(ev))}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatLatency(ev.avg_latency_ms)}
                        </td>
                        <td className="hidden px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground lg:table-cell">
                          {formatNumber(ev.tokens_per_second)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
                          >
                            Details <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: cards */}
          <ul className="space-y-2.5 md:hidden">
            {pageRows.map((ev) => {
              const ci = resolveCI(ev);
              return (
                <li key={ev.id}>
                  <Link
                    href={`/dashboard/evaluations/${ev.id}`}
                    className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors active:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: getVendorColor(ev.models?.vendor) }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {formatModelName(ev.models?.name)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatVendor(ev.models?.vendor)} · {ev.benchmarks?.name ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
                      {ev.status === "completed" ? (
                        <AccuracyWithCI
                          accuracy={ci.accuracy}
                          lower={ci.lower}
                          upper={ci.upper}
                          ciFormat="range"
                          size="md"
                        />
                      ) : (
                        <StatusBadge status={ev.displayStatus} />
                      )}
                      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                        {formatLatency(ev.avg_latency_ms)} · {formatNumber(ev.tokens_per_second)} tok/s
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <EvaluationsPagination
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={evals.length}
            hrefFor={(p) => filterHref(activeBenchmark, p)}
          />
        </>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Accuracy intervals are Wilson 95% confidence bounds. Reference results are sourced from
          public benchmark reports (HuggingFace, official papers); live runs are scored in-app.
        </span>
      </p>
    </div>
  );
}
