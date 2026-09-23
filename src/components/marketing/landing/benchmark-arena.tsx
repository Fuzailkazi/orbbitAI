"use client";

import { useState, type AnimationEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Filter, GitCompare, ShieldCheck, Trophy } from "lucide-react";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { formatContext, formatLatency, formatNumber, formatPricePerMillion } from "@/lib/format";
import { getVendorColor, getVendorTint } from "@/lib/vendor-colors";
import { CATEGORY_ORDER, EASE_OUT_EXPO, evaluationHref, intervalsOverlap } from "./shared";
import type { ArenaBenchmark, ArenaCategory, ArenaMatchup, ScoreCell } from "./types";

type CategoryFilter = "All" | ArenaCategory;

function formatThroughput(tps: number | null): string {
  return tps === null ? "—" : `${Math.round(tps)} tok/s`;
}

function ArenaScoreRow({ label, vendor, cell }: { label: string; vendor: string; cell: ScoreCell }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-mono text-muted-foreground w-20 shrink-0 truncate font-semibold">
        {label}
      </span>
      <div className="flex-1 min-w-0 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${cell.accuracy}%`,
            backgroundColor: getVendorColor(vendor),
            animation: `landing-grow 0.5s ${EASE_OUT_EXPO} both`,
          }}
        />
      </div>
      <Link
        href={evaluationHref(cell.evaluationId)}
        aria-label={`${label}: open the prompt-level results for this evaluation`}
        className="w-[5.5rem] shrink-0 flex justify-end rounded hover:underline decoration-muted-foreground underline-offset-2"
      >
        <AccuracyWithCI
          accuracy={cell.accuracy}
          lower={cell.lower}
          upper={cell.upper}
          size="xs"
          valueClassName="font-bold"
        />
      </Link>
    </div>
  );
}

function BenchmarkRows({ matchup, benchmarks }: { matchup: ArenaMatchup; benchmarks: ArenaBenchmark[] }) {
  return benchmarks.map((bench) => {
    const diff = bench.a.accuracy - bench.b.accuracy;
    const winnerModel = Math.abs(diff) < 0.05 ? null : diff > 0 ? matchup.modelA : matchup.modelB;
    const delta = winnerModel ? `+${Math.abs(diff).toFixed(1)} pts ${winnerModel.shortName}` : "Tie";
    const withinNoise = winnerModel !== null && intervalsOverlap(bench.a, bench.b);
    return (
      <div
        key={bench.benchmarkId}
        className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 p-4 rounded-2xl border border-border bg-card transition-all shadow-2xs"
      >
        {/* Name & Category */}
        <div className="sm:col-span-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{bench.name}</span>
            <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground">
              {bench.category}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
            {bench.description}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5 tabular-nums">
            {bench.a.n === bench.b.n
              ? `n = ${formatNumber(bench.a.n)}`
              : `n = ${formatNumber(bench.a.n)} / ${formatNumber(bench.b.n)}`}
          </p>
        </div>

        {/* Visual Bars Comparison */}
        <div className="sm:col-span-6 space-y-2 px-0 sm:px-4">
          <ArenaScoreRow label={matchup.modelA.shortName} vendor={matchup.modelA.vendor} cell={bench.a} />
          <ArenaScoreRow label={matchup.modelB.shortName} vendor={matchup.modelB.vendor} cell={bench.b} />
        </div>

        {/* Winner Advantage Badge */}
        <div className="sm:col-span-3 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-end">
          <span
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold font-mono text-foreground"
            style={
              winnerModel
                ? {
                    backgroundColor: getVendorTint(winnerModel.vendor, 10),
                    borderColor: getVendorTint(winnerModel.vendor, 35),
                  }
                : undefined
            }
            title={delta}
          >
            <Trophy
              className="h-3 w-3 shrink-0"
              style={winnerModel ? { color: getVendorColor(winnerModel.vendor) } : undefined}
            />
            <span className="truncate">{delta}</span>
          </span>
          {withinNoise && (
            <span
              className="text-[10px] font-mono text-muted-foreground"
              title="The two Wilson 95% intervals overlap, so this gap may be sampling noise."
            >
              CIs overlap
            </span>
          )}
        </div>
      </div>
    );
  });
}

interface ShownRows {
  key: string;
  matchup: ArenaMatchup;
  benchmarks: ArenaBenchmark[];
}

interface BenchmarkArenaProps {
  matchups: ArenaMatchup[];
  /** Server-rendered empty state (auth-aware link inside). */
  empty: ReactNode;
}

/** Interactive head-to-head arena: matchup tabs, category filter and per-benchmark rows. */
export function BenchmarkArena({ matchups, empty }: BenchmarkArenaProps) {
  const [activeMatchupIndex, setActiveMatchupIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("All");

  const currentMatchup: ArenaMatchup | undefined = matchups[activeMatchupIndex] ?? matchups[0];

  // Only offer the category tabs this matchup actually has data for.
  const presentCategories = CATEGORY_ORDER.filter((c) =>
    currentMatchup?.benchmarks.some((b) => b.category === c)
  );
  const categoryTabs: CategoryFilter[] = ["All", ...presentCategories];
  const activeCategory: CategoryFilter =
    selectedCategory === "All" || presentCategories.includes(selectedCategory) ? selectedCategory : "All";

  // Filter benchmarks according to chosen category tab
  const filteredBenchmarks = !currentMatchup
    ? []
    : activeCategory === "All"
      ? currentMatchup.benchmarks
      : currentMatchup.benchmarks.filter((b) => b.category === activeCategory);

  // Rows swap like AnimatePresence mode="wait": the previous rows fade out upward first, then the
  // new rows mount and fade in. `shown` holds the rows currently on screen while they exit.
  const rowsKey = currentMatchup ? `${currentMatchup.id}-${activeCategory}` : "";
  const [shown, setShown] = useState<ShownRows | null>(
    currentMatchup ? { key: rowsKey, matchup: currentMatchup, benchmarks: filteredBenchmarks } : null
  );
  const exiting = shown !== null && shown.key !== rowsKey;

  function handleRowsAnimationEnd(e: AnimationEvent<HTMLDivElement>) {
    // Bars inside the rows animate too; only the wrapper's own exit ends the swap.
    if (e.target !== e.currentTarget || !exiting || !currentMatchup) return;
    setShown({ key: rowsKey, matchup: currentMatchup, benchmarks: filteredBenchmarks });
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-4 sm:p-10 shadow-xs">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-3 py-1 text-xs font-semibold text-brand mb-3">
            <GitCompare className="h-3.5 w-3.5" />
            <span>Interactive Benchmark Arena</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Head-to-Head Benchmark Comparisons
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Side-by-side empirical performance across standardized benchmarks. Select a flagship matchup and filter categories to inspect measured accuracy, response latency, and token economics.
          </p>
        </div>

        {/* Matchup Switcher Tabs */}
        {matchups.length > 1 && (
          <div role="group" aria-label="Matchup" className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-2xl border border-border shrink-0 sm:flex sm:items-center sm:gap-1.5 sm:overflow-x-auto scrollbar-none">
            {matchups.map((matchup, idx) => (
              <button
                key={matchup.id}
                type="button"
                aria-pressed={currentMatchup === matchup}
                onClick={() => {
                  setActiveMatchupIndex(idx);
                  setSelectedCategory("All");
                }}
                className={`rounded-xl px-3 sm:px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap active:scale-[0.98] ${
                  currentMatchup === matchup
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {matchup.badge}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Matchup Card Body */}
      {!currentMatchup ? (
        <div className="pt-6 sm:pt-8">{empty}</div>
      ) : (
      <div className="pt-6 sm:pt-8 space-y-6">

        {/* Matchup Banner & Model Identities */}
        <div className="bg-muted/40 p-4 sm:p-6 rounded-2xl border border-border space-y-5 sm:space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                {currentMatchup.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentMatchup.subtitle}
              </p>
            </div>

            {/* Model Chips */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {[currentMatchup.modelA, currentMatchup.modelB].map((model, i) => (
                <div key={model.id} className="contents">
                  {i === 1 && <span className="text-xs font-mono font-bold text-muted-foreground">VS</span>}
                  <div className="flex min-w-0 max-w-full items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getVendorColor(model.vendor) }} />
                    <span className="text-xs font-bold text-foreground truncate">{model.shortName}</span>
                    <span className="hidden sm:inline text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground whitespace-nowrap">{model.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hardware & Economics HUD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            {[
              {
                label: "Median Latency (P50)",
                a: formatLatency(currentMatchup.specs.latencyA),
                b: formatLatency(currentMatchup.specs.latencyB),
              },
              {
                label: "Price / 1M Input Tokens",
                a: formatPricePerMillion(currentMatchup.specs.priceA),
                b: formatPricePerMillion(currentMatchup.specs.priceB),
              },
              {
                label: "Context Window",
                a: formatContext(currentMatchup.specs.contextA),
                b: formatContext(currentMatchup.specs.contextB),
              },
              {
                label: "Throughput Speed",
                a: formatThroughput(currentMatchup.specs.throughputA),
                b: formatThroughput(currentMatchup.specs.throughputB),
              },
            ].map((spec) => (
              <div key={spec.label} className="bg-card p-3.5 rounded-xl border border-border shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">{spec.label}</span>
                <p className="text-sm font-bold text-foreground mt-1">
                  {spec.a} <span className="font-normal text-muted-foreground">vs</span> {spec.b}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="hidden sm:block h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="hidden sm:inline text-xs font-semibold text-muted-foreground">Filter Benchmark:</span>
            <div role="group" aria-label="Filter benchmark category" className="flex items-center gap-1.5 flex-wrap">
              {categoryTabs.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={activeCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            Showing {filteredBenchmarks.length} {filteredBenchmarks.length === 1 ? "suite" : "suites"}
          </span>
        </div>

        {/* Benchmark Comparison Rows */}
        <div className="space-y-3">
          <div className="hidden sm:grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 pb-1">
            <div className="col-span-3">Benchmark Suite & Focus</div>
            <div className="col-span-6 text-center">Accuracy ± Wilson 95% CI</div>
            <div className="col-span-3 text-right">Advantage Delta</div>
          </div>

          {exiting && shown ? (
            <div
              key={shown.key}
              onAnimationEnd={handleRowsAnimationEnd}
              className="space-y-2.5 animate-[landing-rows-out_0.25s_ease-out_forwards]"
            >
              <BenchmarkRows matchup={shown.matchup} benchmarks={shown.benchmarks} />
            </div>
          ) : (
            <div key={rowsKey} className="space-y-2.5 animate-[landing-rows-in_0.25s_ease-out_both]">
              <BenchmarkRows matchup={currentMatchup} benchmarks={filteredBenchmarks} />
            </div>
          )}
        </div>

        {/* Bottom Callout */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span>Every score is a recorded evaluation with its Wilson 95% CI. Click a score to see each graded prompt.</span>
          </div>
          <Link
            href={`/dashboard/compare?a=${currentMatchup.modelA.id}&b=${currentMatchup.modelB.id}`}
            className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"
          >
            <span>Launch full interactive compare matrix</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>
      )}
    </div>
  );
}
