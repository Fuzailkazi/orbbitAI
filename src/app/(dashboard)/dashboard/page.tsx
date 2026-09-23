import type { Metadata } from "next";
import Link from "next/link";
import { Layers, BookOpen, Play, ArrowRight, BarChart3, ChevronRight } from "lucide-react";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import type { TopModelsChartDatum } from "@/components/charts/top-models-chart";
import { evaluationTimestamp, getActiveModels, getBenchmarks, getCompletedEvaluations } from "@/lib/data";
import { formatModelName, formatNumber, formatVendor, resolveCI, scoredQuestionCount } from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { DashboardCharts } from "./dashboard-charts";

const SCORING_LABELS: Record<string, string> = {
  exact_match: "Exact Match",
  normalized_match: "Normalized",
  pass_at_k: "Pass@k",
  llm_judge: "LLM Judge",
  bleu: "BLEU",
  rouge: "ROUGE",
};

export const metadata: Metadata = { title: "Overview" };

const TOP_VENDOR_COUNT = 6;

// Reads only the cached public data layer (no cookies, searchParams or uncached queries), so the
// whole overview is prerendered and served/prefetched as static; the cache tags revalidate it.
export default async function DashboardPage() {
  const [models, benchmarks, evaluations] = await Promise.all([
    getActiveModels(),
    getBenchmarks(),
    getCompletedEvaluations(),
  ]);
  const modelCount = models.length;

  // Provider distribution (vendor slugs and display names are merged via formatVendor).
  const vendorCounts = new Map<string, number>();
  for (const m of models) {
    const vendor = formatVendor(m.vendor);
    vendorCounts.set(vendor, (vendorCounts.get(vendor) ?? 0) + 1);
  }
  const sortedVendors = [...vendorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topVendors = sortedVendors.slice(0, TOP_VENDOR_COUNT).map(([name, count]) => ({ name, count }));
  const otherVendorCount = sortedVendors.slice(TOP_VENDOR_COUNT).reduce((sum, [, count]) => sum + count, 0);
  const otherVendorProviders = Math.max(0, sortedVendors.length - TOP_VENDOR_COUNT);
  const vendorTotal = models.length || 1;

  // Best evaluation per model. Ties on accuracy are broken by the tighter CI (higher lower
  // bound), then by the larger sample, so the ranking is deterministic and explainable.
  const bestByModel = new Map<string, TopModelsChartDatum>();
  const tieLower = (d: TopModelsChartDatum) => d.ciLower ?? 0;
  for (const ev of evaluations) {
    if (!ev.models?.name || ev.accuracy === null) continue;
    const ci = resolveCI(ev);
    const candidate = {
      name: ev.models.name,
      vendor: ev.models.vendor ?? "Unknown",
      score: ev.accuracy,
      ciLower: ci.lower,
      ciUpper: ci.upper,
      benchmark: ev.benchmarks?.name ?? null,
      n: scoredQuestionCount(ev),
      href: `/dashboard/evaluations/${ev.id}`,
    } satisfies TopModelsChartDatum;
    const existing = bestByModel.get(ev.models.name);
    const better =
      !existing ||
      candidate.score > existing.score ||
      (candidate.score === existing.score && tieLower(candidate) > tieLower(existing));
    if (better) bestByModel.set(ev.models.name, candidate);
  }
  const topModelsForChart: TopModelsChartDatum[] = [...bestByModel.values()]
    .sort((a, b) => b.score - a.score || tieLower(b) - tieLower(a) || (b.n ?? 0) - (a.n ?? 0))
    .slice(0, 10);

  const recentEvaluations = [...evaluations].sort((a, b) => evaluationTimestamp(b) - evaluationTimestamp(a)).slice(0, 5);
  const totalQuestions = benchmarks.reduce((sum, b) => sum + (b.total_questions ?? 0), 0);

  const stats = [
    {
      label: "Total Models",
      value: formatNumber(modelCount),
      hint: `${formatNumber(vendorCounts.size)} providers`,
      icon: Layers,
    },
    {
      label: "Benchmark Suites",
      value: formatNumber(benchmarks.length),
      hint: `${formatNumber(totalQuestions)} questions`,
      icon: BookOpen,
    },
    {
      label: "Evaluations",
      value: formatNumber(evaluations.length),
      hint: `${formatNumber(bestByModel.size)} models evaluated`,
      icon: Play,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16 sm:space-y-8">
      {/* 1. Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed evaluations across every benchmark suite, with Wilson 95% confidence intervals.
          </p>
        </div>
        <Link
          href="/dashboard/evaluate"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Run evaluation</span>
        </Link>
      </div>

      {/* 2. Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <stat.icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      {/* 3. Charts */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold text-foreground">Top performing models</h2>
            <p className="text-xs text-muted-foreground">Best completed run per model · accuracy ±95% CI</p>
          </div>
          {topModelsForChart.length > 0 ? (
            <DashboardCharts data={topModelsForChart} />
          ) : (
            <p className="text-sm text-muted-foreground">No evaluations recorded yet.</p>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Provider distribution</h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatNumber(models.length)} active</span>
          </div>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full border border-border bg-muted" aria-hidden>
            {topVendors.map((v) => (
              <div
                key={v.name}
                className="h-full"
                style={{ width: `${(v.count / vendorTotal) * 100}%`, backgroundColor: getVendorColor(v.name) }}
              />
            ))}
          </div>
          <ul className="space-y-3">
            {topVendors.map((v) => (
              <li key={v.name} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: getVendorColor(v.name) }} />
                  <span className="truncate font-medium text-foreground">{v.name}</span>
                </div>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {v.count} <span className="text-xs">({Math.round((v.count / vendorTotal) * 100)}%)</span>
                </span>
              </li>
            ))}
            {otherVendorCount > 0 && (
              <li className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border bg-muted" />
                  <span className="truncate text-muted-foreground">
                    {otherVendorProviders} other providers
                  </span>
                </div>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {otherVendorCount} <span className="text-xs">({Math.round((otherVendorCount / vendorTotal) * 100)}%)</span>
                </span>
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* 4. Benchmark suites */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Active benchmark suites</h2>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_4.5rem] gap-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-4">
              <span>Benchmark</span>
              <span>Category</span>
              <span className="text-right">Questions</span>
              <span className="hidden text-right sm:block">Scoring</span>
            </div>
            {benchmarks.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[minmax(0,1fr)_6rem_4.5rem] items-center gap-4 py-3 text-sm sm:grid-cols-4"
              >
                <span className="truncate font-medium text-foreground" title={b.name}>{b.name}</span>
                <span>
                  <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
                    {b.category}
                  </span>
                </span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">
                  {formatNumber(b.total_questions)}
                </span>
                <span className="hidden text-right text-muted-foreground sm:block">
                  {SCORING_LABELS[b.scoring_method] ?? b.scoring_method}
                </span>
              </div>
            ))}
            {benchmarks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No benchmark suites configured.</p>
            )}
          </div>
        </section>

        {/* 5. Recent evaluations */}
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent evaluations</h2>
            <Link
              href="/dashboard/evaluations"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {recentEvaluations.map((ev) => {
              const ci = resolveCI(ev);
              return (
                <li key={ev.id}>
                  <Link
                    href={`/dashboard/evaluations/${ev.id}`}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-foreground/20 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={ev.models?.name}>
                        {formatModelName(ev.models?.name)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ev.benchmarks?.name ?? "Unknown benchmark"}
                        <span className="font-mono"> · n={formatNumber(scoredQuestionCount(ev))}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <AccuracyWithCI
                        accuracy={ci.accuracy}
                        lower={ci.lower}
                        upper={ci.upper}
                        variant="stacked"
                        size="sm"
                        align="end"
                        valueClassName="font-semibold"
                      />
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
            {evaluations.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">No evaluations yet.</li>
            )}
          </ul>
        </section>
      </div>

      {/* 6. Quick actions */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {[
          {
            href: "/dashboard/models",
            icon: Layers,
            title: "Browse models",
            body: "Explore available AI models and their capabilities",
          },
          {
            href: "/dashboard/leaderboard",
            icon: BarChart3,
            title: "View leaderboard",
            body: "Compare model performance across benchmark suites",
          },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md active:scale-[0.99] sm:p-6"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <action.icon className="h-5 w-5 text-foreground" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{action.title}</p>
                <p className="text-sm text-muted-foreground">{action.body}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
