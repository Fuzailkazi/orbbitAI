"use client";

import { Suspense, lazy, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  Radar as RadarIcon,
  SlidersHorizontal,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModelPicker } from "@/components/models/model-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import type { ComparisonVerdict, ExecutiveReportAccuracy } from "@/components/evaluations/executive-report-modal";
import { calculateWilsonConfidenceInterval } from "@/lib/eval/statistics";
import {
  formatContext,
  formatCost,
  formatLatency,
  formatModelName,
  formatNumber,
  formatPct,
  formatPricePerMillion,
  formatVendor,
  resolveCI,
  scoredQuestionCount,
} from "@/lib/format";
import { getSeriesColor, getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";

// ─── Lazy chunks ────────────────────────────────────────────────────────────

// The radar (recharts) sits below the accuracy table and the memo only opens on click, so both
// load as separate chunks instead of weighing down the first render.
const BenchmarkRadarChart = lazy(async () => ({
  default: (await import("@/components/charts/benchmark-radar-chart")).BenchmarkRadarChart,
}));

const loadExecutiveReport = () => import("@/components/evaluations/executive-report-modal");
const ExecutiveReportModal = lazy(async () => ({ default: (await loadExecutiveReport()).ExecutiveReportModal }));

/** Warm the memo chunk on hover/focus so the first click opens it without a visible wait. */
function preloadExecutiveReport() {
  void loadExecutiveReport().catch(() => undefined);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompareModel {
  id: string;
  name: string;
  vendor: string;
  api_identifier: string;
  category: string;
  context_window: number;
  pricing_input: number;
  pricing_output: number;
}

/** Latest completed evaluation per (model, benchmark), flattened by the server page. */
export interface CompareEvaluation {
  id: string;
  model_id: string;
  benchmark_id: string;
  benchmark_name: string;
  benchmark_category: string | null;
  benchmark_scoring_method: string | null;
  accuracy: number | null;
  accuracy_ci_lower: number | null;
  accuracy_ci_upper: number | null;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  tokens_per_second: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  failure_rate: number | null;
  questions_evaluated: number;
  questions_correct: number;
}

type Interval = ExecutiveReportAccuracy;
type EvalIndex = Map<string, Map<string, CompareEvaluation>>;
type Better = "a" | "b" | "tie";

interface BenchmarkComparison {
  benchmarkId: string;
  name: string;
  category: string | null;
  evalA: CompareEvaluation;
  evalB: CompareEvaluation;
  a: Interval;
  b: Interval;
  delta: number | null;
  verdict: ComparisonVerdict;
}

interface PairSuggestion {
  a: string;
  b: string;
  shared: number;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

function isNum(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function vendorSlug(m: CompareModel): string {
  const slug = m.api_identifier.split("/")[0]?.replace(/^~/, "");
  return slug || m.vendor;
}

function vendorName(m: CompareModel): string {
  return formatVendor(vendorSlug(m));
}

/** Vendor colors for the two series, guaranteed to differ when both models share a vendor. */
function pairColors(a: CompareModel, b: CompareModel): [string, string] {
  const ca = getVendorColor(vendorSlug(a), getSeriesColor(0));
  let cb = getVendorColor(vendorSlug(b), getSeriesColor(2));
  if (cb === ca) {
    cb = ca === "var(--brand)" || ca === getVendorColor("google") ? "var(--chart-4)" : "var(--brand)";
  }
  return [ca, cb];
}

function intervalOf(e: CompareEvaluation): Interval {
  const r = resolveCI(e);
  return { accuracy: r.accuracy, lower: r.lower, upper: r.upper };
}

/** Non-overlapping Wilson 95% intervals → a significant winner; overlap → "tie". */
function compareIntervals(a: Interval, b: Interval): ComparisonVerdict {
  if (!isNum(a.lower) || !isNum(a.upper) || !isNum(b.lower) || !isNum(b.upper)) return "unknown";
  if (a.lower > b.upper) return "a";
  if (b.lower > a.upper) return "b";
  return "tie";
}

/**
 * Pooled (micro-averaged) accuracy Σ correct / Σ questions with a Wilson 95% CI.
 * LLM-judge benchmarks are excluded: their scores are graded, not binomial pass/fail,
 * so a Wilson interval over pooled counts would not be meaningful.
 */
function pooledInterval(evals: CompareEvaluation[]): Interval & { questions: number } {
  let n = 0;
  let k = 0;
  for (const e of evals) {
    // Denominator = scored prompts (failed calls and unscored prompts are not in accuracy).
    const scored = scoredQuestionCount(e);
    if (scored > 0 && !isJudged(e)) {
      n += scored;
      k += e.questions_correct;
    }
  }
  if (n === 0) return { accuracy: null, lower: null, upper: null, questions: 0 };
  const ci = calculateWilsonConfidenceInterval(k, n);
  return { accuracy: (k / n) * 100, lower: ci.lower, upper: ci.upper, questions: n };
}

function isJudged(e: CompareEvaluation): boolean {
  return e.benchmark_scoring_method === "llm_judge";
}

function mean(values: Array<number | null>, positiveOnly = false): number | null {
  const xs = values.filter((v): v is number => isNum(v) && (!positiveOnly || v > 0));
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function sum(values: Array<number | null>): number | null {
  const xs = values.filter(isNum);
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0);
}

function better(a: number | null, b: number | null, lowerIsBetter: boolean): Better {
  if (!isNum(a) || !isNum(b) || a === b) return "tie";
  return (a < b) === lowerIsBetter ? "a" : "b";
}

function buildIndex(evaluations: CompareEvaluation[]): EvalIndex {
  const index: EvalIndex = new Map();
  for (const e of evaluations) {
    let byBench = index.get(e.model_id);
    if (!byBench) {
      byBench = new Map();
      index.set(e.model_id, byBench);
    }
    byBench.set(e.benchmark_id, e);
  }
  return index;
}

function sharedCount(index: EvalIndex, a: string, b: string): number {
  const ea = index.get(a);
  const eb = index.get(b);
  if (!ea || !eb) return 0;
  let count = 0;
  for (const key of ea.keys()) if (eb.has(key)) count++;
  return count;
}

/** The evaluated model sharing the most benchmarks with `modelId` (ties → more evaluations, then name). */
function bestPartner(
  index: EvalIndex,
  modelById: Map<string, CompareModel>,
  modelId: string,
  exclude: ReadonlySet<string>
): PairSuggestion | null {
  let best: PairSuggestion | null = null;
  let bestSize = 0;
  for (const [other, evals] of index) {
    if (other === modelId || exclude.has(other) || !modelById.has(other)) continue;
    const shared = sharedCount(index, modelId, other);
    if (shared === 0) continue;
    const tieBreak =
      best !== null &&
      shared === best.shared &&
      (evals.size > bestSize ||
        (evals.size === bestSize &&
          (modelById.get(other)?.name ?? "") < (modelById.get(best.b)?.name ?? "")));
    if (!best || shared > best.shared || tieBreak) {
      best = { a: modelId, b: other, shared };
      bestSize = evals.size;
    }
  }
  return best;
}

/** Default pair: the most-evaluated model vs the model it shares the most benchmarks with. */
function defaultPair(index: EvalIndex, models: CompareModel[], modelById: Map<string, CompareModel>): [string, string] {
  const ranked = [...index.entries()]
    .filter(([id]) => modelById.has(id))
    .sort(
      (x, y) =>
        y[1].size - x[1].size ||
        (modelById.get(x[0])?.name ?? "").localeCompare(modelById.get(y[0])?.name ?? "")
    );
  for (const [id] of ranked) {
    const partner = bestPartner(index, modelById, id, new Set());
    if (partner) return [id, partner.b];
  }
  return [models[0]?.id ?? "", models[1]?.id ?? ""];
}

function suggestPairs(
  index: EvalIndex,
  models: CompareModel[],
  modelById: Map<string, CompareModel>,
  idA: string,
  idB: string
): PairSuggestion[] {
  const out: PairSuggestion[] = [];
  const add = (s: PairSuggestion | null) => {
    if (!s || (s.a === idA && s.b === idB)) return;
    if (out.some((o) => (o.a === s.a && o.b === s.b) || (o.a === s.b && o.b === s.a))) return;
    out.push(s);
  };
  if (index.has(idA)) add(bestPartner(index, modelById, idA, new Set([idB])));
  if (index.has(idB)) {
    const p = bestPartner(index, modelById, idB, new Set([idA]));
    add(p ? { a: p.b, b: idB, shared: p.shared } : null);
  }
  const [da, db] = defaultPair(index, models, modelById);
  add({ a: da, b: db, shared: sharedCount(index, da, db) });
  return out.filter((s) => s.shared > 0).slice(0, 3);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Presentational pieces ──────────────────────────────────────────────────

const CARD = "rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6";

function CardHeader({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-foreground" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />
  );
}

function ModelColumnLabels({
  first,
  a,
  b,
  colorA,
  colorB,
}: {
  first: string;
  a: CompareModel;
  b: CompareModel;
  colorA: string;
  colorB: string;
}) {
  return (
    <div className="mb-1 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 border-b border-border pb-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{first}</span>
      {[
        { m: a, c: colorA },
        { m: b, c: colorB },
      ].map(({ m, c }) => (
        <div key={m.id} className="min-w-0 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-foreground sm:text-sm">
            <Dot color={c} />
            <span className="line-clamp-2 break-words sm:line-clamp-1" title={m.name}>
              {formatModelName(m.name)}
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{vendorName(m)}</p>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ label, a, b, winner }: { label: string; a: string; b: string; winner: Better }) {
  const cell = (value: string, isWinner: boolean) => (
    <div className="min-w-0 text-center font-mono text-xs tabular-nums sm:text-sm">
      <span
        className={cn(
          isWinner
            ? "inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-muted px-1.5 py-1 font-semibold text-foreground sm:gap-1.5 sm:px-2"
            : "whitespace-nowrap text-muted-foreground"
        )}
      >
        {value}
        {isWinner && <Check className="size-3.5 stroke-[2.5] text-brand" aria-label="better" />}
      </span>
    </div>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-b border-border/60 py-3 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {cell(a, winner === "a")}
      {cell(b, winner === "b")}
    </div>
  );
}

function VerdictChip({ verdict, className }: { verdict: ComparisonVerdict; className?: string }) {
  if (verdict === "a" || verdict === "b") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success",
          className
        )}
        title="The 95% confidence intervals do not overlap"
      >
        <Check className="size-3" aria-hidden />
        {verdict === "a" ? "A leads" : "B leads"}
      </span>
    );
  }
  if (verdict === "tie") {
    return (
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className
        )}
        title="The 95% confidence intervals overlap, so the difference is not statistically significant"
      >
        Not distinguishable
      </span>
    );
  }
  return (
    <span className={cn("whitespace-nowrap text-[11px] text-muted-foreground", className)}>CI unavailable</span>
  );
}

function IntervalPlot({ a, b, colorA, colorB }: { a: Interval; b: Interval; colorA: string; colorB: string }) {
  if (!isNum(a.lower) || !isNum(a.upper) || !isNum(b.lower) || !isNum(b.upper)) {
    return <span className="text-[11px] text-muted-foreground">CI n/a</span>;
  }
  let lo = Math.max(0, Math.floor(Math.min(a.lower, b.lower) - 1));
  let hi = Math.min(100, Math.ceil(Math.max(a.upper, b.upper) + 1));
  if (hi - lo < 8) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, Math.floor(mid - 4));
    hi = Math.min(100, lo + 8);
    lo = Math.max(0, hi - 8);
  }
  const pos = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  const span = (l: number, u: number) => ({ left: pos(l), right: `calc(100% - ${pos(u)})` });
  const overlapLo = Math.max(a.lower, b.lower);
  const overlapHi = Math.min(a.upper, b.upper);

  const lane = (iv: Interval, color: string, top: string) =>
    isNum(iv.lower) && isNum(iv.upper) ? (
      <>
        <span
          className="absolute h-1.5 rounded-full"
          style={{ ...span(iv.lower, iv.upper), top, backgroundColor: color, opacity: 0.35 }}
        />
        {isNum(iv.accuracy) && (
          <span
            className="absolute size-2.5 -translate-x-1/2 -translate-y-0.5 rounded-full ring-2 ring-card"
            style={{ left: pos(iv.accuracy), top, backgroundColor: color }}
          />
        )}
      </>
    ) : null;

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">{lo}</span>
      <div
        className="relative h-7 flex-1"
        role="img"
        aria-label={`95% intervals: A ${a.lower}–${a.upper}, B ${b.lower}–${b.upper}`}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {overlapHi > overlapLo && (
          <span className="absolute inset-y-0 rounded-sm bg-muted" style={span(overlapLo, overlapHi)} />
        )}
        {lane(a, colorA, "6px")}
        {lane(b, colorB, "16px")}
      </div>
      <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{hi}</span>
    </div>
  );
}

function AccuracyLink({ evaluation, interval, highlight }: { evaluation: CompareEvaluation; interval: Interval; highlight: boolean }) {
  return (
    <Link
      href={`/dashboard/evaluations/${evaluation.id}`}
      className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      title="Open per-question results"
    >
      <AccuracyWithCI accuracy={interval.accuracy} lower={interval.lower} upper={interval.upper} />
      {highlight && <Check className="size-3.5 stroke-[2.5] text-brand" aria-label="significantly better" />}
    </Link>
  );
}

const BENCH_GRID =
  "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.65fr)_minmax(0,1fr)]";

function BenchmarkTable({
  rows,
  a,
  b,
  colorA,
  colorB,
}: {
  rows: BenchmarkComparison[];
  a: CompareModel;
  b: CompareModel;
  colorA: string;
  colorB: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "hidden items-end gap-3 border-b border-border pb-2.5 text-xs font-medium text-muted-foreground md:grid",
          BENCH_GRID
        )}
      >
        <span className="uppercase tracking-wider">Benchmark</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Dot color={colorA} />
          <span className="truncate">A · {formatModelName(a.name)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Dot color={colorB} />
          <span className="truncate">B · {formatModelName(b.name)}</span>
        </span>
        <span>95% CI overlap</span>
        <span className="text-right">Δ (B − A)</span>
        <span className="text-right">Result</span>
      </div>

      {rows.map((r) => (
        <div
          key={r.benchmarkId}
          className={cn(
            "grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-border/60 py-3.5 last:border-0 md:gap-y-0",
            BENCH_GRID
          )}
        >
          <div className="order-1 min-w-0 md:order-1">
            <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
            {(r.category || isJudged(r.evalA)) && (
              <p className="truncate text-xs text-muted-foreground">
                <span className="capitalize">{r.category}</span>
                {isJudged(r.evalA) && (r.category ? " · LLM judge" : "LLM judge")}
              </p>
            )}
          </div>

          <div className="order-2 flex items-center justify-end gap-2 md:contents">
            <span
              className={cn(
                "whitespace-nowrap font-mono text-xs font-semibold tabular-nums md:order-5 md:text-right",
                r.verdict === "b" && "text-success",
                r.verdict === "a" && "text-destructive",
                (r.verdict === "tie" || r.verdict === "unknown") && "text-muted-foreground"
              )}
            >
              {r.delta === null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)} pp`}
            </span>
            <span className="md:order-6 md:flex md:justify-end">
              <VerdictChip verdict={r.verdict} />
            </span>
          </div>

          <div className="order-3 min-w-0 md:order-2">
            <p className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground md:hidden">
              <Dot color={colorA} className="size-1.5" /> A
            </p>
            <AccuracyLink evaluation={r.evalA} interval={r.a} highlight={r.verdict === "a"} />
          </div>
          <div className="order-4 min-w-0 md:order-3">
            <p className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground md:hidden">
              <Dot color={colorB} className="size-1.5" /> B
            </p>
            <AccuracyLink evaluation={r.evalB} interval={r.b} highlight={r.verdict === "b"} />
          </div>

          <div className="order-5 col-span-2 min-w-0 md:order-4 md:col-span-1">
            <IntervalPlot a={r.a} b={r.b} colorA={colorA} colorB={colorB} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PooledTile({
  label,
  model,
  color,
  pooled,
}: {
  label: string;
  model: CompareModel;
  color: string;
  pooled: Interval & { questions: number };
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Dot color={color} />
        <span className="truncate">
          {label} · <span className="font-medium text-foreground">{formatModelName(model.name)}</span>
        </span>
      </p>
      <AccuracyWithCI
        className="mt-3"
        variant="stacked"
        size="lg"
        accuracy={pooled.accuracy}
        lower={pooled.lower}
        upper={pooled.upper}
      />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pooled over {formatNumber(pooled.questions)} questions
      </p>
    </div>
  );
}

function NoSharedBenchmarks({
  a,
  b,
  benchA,
  benchB,
  suggestions,
  modelById,
  onPick,
}: {
  a: CompareModel;
  b: CompareModel;
  benchA: string[];
  benchB: string[];
  suggestions: PairSuggestion[];
  modelById: Map<string, CompareModel>;
  onPick: (a: string, b: string) => void;
}) {
  const nameA = formatModelName(a.name);
  const nameB = formatModelName(b.name);
  const list = (xs: string[]) => (xs.length > 4 ? `${xs.slice(0, 4).join(", ")} +${xs.length - 4}` : xs.join(", "));

  let message: string;
  if (benchA.length === 0 && benchB.length === 0) {
    message = `Neither ${nameA} nor ${nameB} has a completed evaluation yet, so only specs and pricing can be compared.`;
  } else if (benchA.length === 0) {
    message = `${nameA} has no completed evaluations yet. ${nameB} has been evaluated on ${list(benchB)}.`;
  } else if (benchB.length === 0) {
    message = `${nameB} has no completed evaluations yet. ${nameA} has been evaluated on ${list(benchA)}.`;
  } else {
    message = `${nameA} was evaluated on ${list(benchA)}; ${nameB} on ${list(benchB)}. Accuracy is only compared on benchmarks both models ran.`;
  }

  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <Target className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-foreground">No shared benchmarks</p>
      <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">{message}</p>

      {suggestions.length > 0 && (
        <div className="mt-5 w-full max-w-2xl">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Try a pair with evaluation data</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {suggestions.map((s) => {
              const ma = modelById.get(s.a);
              const mb = modelById.get(s.b);
              if (!ma || !mb) return null;
              const [ca, cb] = pairColors(ma, mb);
              return (
                <button
                  key={`${s.a}-${s.b}`}
                  type="button"
                  onClick={() => onPick(s.a, s.b)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-2xs transition-colors hover:bg-muted"
                >
                  <Dot color={ca} />
                  <span className="truncate font-medium">{formatModelName(ma.name)}</span>
                  <span className="text-muted-foreground">vs</span>
                  <Dot color={cb} />
                  <span className="truncate font-medium">{formatModelName(mb.name)}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{s.shared} shared</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Link href="/dashboard/evaluate" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5")}>
        <FlaskConical /> Run an evaluation
      </Link>
    </div>
  );
}

// ─── Main client ────────────────────────────────────────────────────────────

export function CompareClient({ models, evaluations }: { models: CompareModel[]; evaluations: CompareEvaluation[] }) {
  const searchParams = useSearchParams();
  const [evaluatedOnly, setEvaluatedOnly] = useState<{ A: boolean; B: boolean }>({ A: true, B: true });
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Cache Components keeps recently visited routes mounted but hidden; close the memo when this
  // route is hidden so it doesn't reappear open on back/forward.
  useLayoutEffect(() => () => setIsReportOpen(false), []);

  const modelById = new Map(models.map((m) => [m.id, m]));
  const index = buildIndex(evaluations);
  const evaluatedCount = [...index.keys()].filter((id) => modelById.has(id)).length;

  // URL is the source of truth (?a=<id>&b=<id>); fall back to the best-covered pair.
  // ?model=<id> (from the model detail page) is an alias for side A.
  const [defA, defB] = defaultPair(index, models, modelById);
  const paramA = searchParams.get("a") ?? searchParams.get("model");
  const paramB = searchParams.get("b");
  const idA = paramA && modelById.has(paramA) ? paramA : defA;
  let idB =
    paramB && modelById.has(paramB)
      ? paramB
      : paramA && modelById.has(paramA)
        ? (bestPartner(index, modelById, idA, new Set())?.b ?? defB)
        : defB;
  if (idB === idA) {
    idB = bestPartner(index, modelById, idA, new Set())?.b ?? models.find((m) => m.id !== idA)?.id ?? "";
  }

  const a = modelById.get(idA);
  const b = modelById.get(idB);

  function setPair(nextA: string, nextB: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("model");
    params.set("a", nextA);
    params.set("b", nextB);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  const evA = index.get(idA) ?? new Map<string, CompareEvaluation>();
  const evB = index.get(idB) ?? new Map<string, CompareEvaluation>();

  const rows: BenchmarkComparison[] = [...evA.values()]
    .flatMap((ea) => {
      const eb = evB.get(ea.benchmark_id);
      if (!eb) return [];
      const ia = intervalOf(ea);
      const ib = intervalOf(eb);
      return [
        {
          benchmarkId: ea.benchmark_id,
          name: ea.benchmark_name,
          category: ea.benchmark_category,
          evalA: ea,
          evalB: eb,
          a: ia,
          b: ib,
          delta: isNum(ia.accuracy) && isNum(ib.accuracy) ? ib.accuracy - ia.accuracy : null,
          verdict: compareIntervals(ia, ib),
        },
      ];
    })
    .sort((x, y) => x.name.localeCompare(y.name));

  const sharedA = rows.map((r) => r.evalA);
  const sharedB = rows.map((r) => r.evalB);
  const pooledA = pooledInterval(sharedA);
  const pooledB = pooledInterval(sharedB);
  const overall = rows.length > 0 ? compareIntervals(pooledA, pooledB) : "unknown";
  const winsA = rows.filter((r) => r.verdict === "a").length;
  const winsB = rows.filter((r) => r.verdict === "b").length;
  const ties = rows.filter((r) => r.verdict === "tie").length;

  const judgedShared = rows.filter((r) => isJudged(r.evalA)).map((r) => r.name);
  const onlyA = [...evA.values()].filter((e) => !evB.has(e.benchmark_id)).map((e) => e.benchmark_name).sort();
  const onlyB = [...evB.values()].filter((e) => !evA.has(e.benchmark_id)).map((e) => e.benchmark_name).sort();

  const perf = {
    latencyA: mean(sharedA.map((e) => e.avg_latency_ms), true),
    latencyB: mean(sharedB.map((e) => e.avg_latency_ms), true),
    p95A: mean(sharedA.map((e) => e.p95_latency_ms), true),
    p95B: mean(sharedB.map((e) => e.p95_latency_ms), true),
    tpsA: mean(sharedA.map((e) => e.tokens_per_second), true),
    tpsB: mean(sharedB.map((e) => e.tokens_per_second), true),
    failA: mean(sharedA.map((e) => e.failure_rate)),
    failB: mean(sharedB.map((e) => e.failure_rate)),
    tokQA: pooledA.questions > 0 ? (sum(sharedA.map((e) => e.total_tokens)) ?? 0) / pooledA.questions : null,
    tokQB: pooledB.questions > 0 ? (sum(sharedB.map((e) => e.total_tokens)) ?? 0) / pooledB.questions : null,
    costA: sum(sharedA.map((e) => e.total_cost)),
    costB: sum(sharedB.map((e) => e.total_cost)),
  };

  function exportComparisonJson() {
    if (!a || !b) return;
    const payload = {
      generated_at: new Date().toISOString(),
      share_url: `${window.location.origin}${window.location.pathname}?a=${a.id}&b=${b.id}`,
      method: "Wilson 95% confidence intervals; a difference is significant when the intervals do not overlap.",
      model_a: {
        id: a.id,
        name: a.name,
        api_identifier: a.api_identifier,
        context_window: a.context_window,
        pricing_input_per_1m: a.pricing_input,
        pricing_output_per_1m: a.pricing_output,
        pooled_accuracy: pooledA,
      },
      model_b: {
        id: b.id,
        name: b.name,
        api_identifier: b.api_identifier,
        context_window: b.context_window,
        pricing_input_per_1m: b.pricing_input,
        pricing_output_per_1m: b.pricing_output,
        pooled_accuracy: pooledB,
      },
      overall_verdict: overall,
      benchmarks: rows.map((r) => ({
        benchmark: r.name,
        model_a: { evaluation_id: r.evalA.id, ...r.a, avg_latency_ms: r.evalA.avg_latency_ms },
        model_b: { evaluation_id: r.evalB.id, ...r.b, avg_latency_ms: r.evalB.avg_latency_ms },
        delta_pp: r.delta,
        verdict: r.verdict,
      })),
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbbit-compare-${slugify(formatModelName(a.name))}-vs-${slugify(formatModelName(b.name))}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Comparison exported as JSON");
    } catch {
      toast.error("Couldn't export the comparison");
    }
  }

  async function copyShareUrl() {
    const url = `${window.location.origin}${window.location.pathname}?a=${encodeURIComponent(idA)}&b=${encodeURIComponent(idB)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
      if (!paramA || !paramB) setPair(idA, idB);
    } catch {
      toast.error("Couldn't copy the link", { description: "Copy it from the address bar instead." });
    }
  }

  const [colorA, colorB] = a && b ? pairColors(a, b) : [getSeriesColor(0), getSeriesColor(2)];
  const evalFilter = (m: CompareModel) => index.has(m.id);

  const selectors = [
    { key: "A" as const, tag: "Baseline model", value: idA, other: idB, color: colorA, count: evA.size },
    { key: "B" as const, tag: "Candidate model", value: idB, other: idA, color: colorB, count: evB.size },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Model Comparison</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Head-to-head accuracy with Wilson 95% confidence intervals, plus latency, throughput and pricing.
          </p>
        </div>
        {a && b && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsReportOpen(true)}
              onPointerEnter={preloadExecutiveReport}
              onFocus={preloadExecutiveReport}
              className="h-8 px-3 text-xs"
            >
              <FileText className="size-3.5" />
              <span className="sm:hidden">Memo</span>
              <span className="hidden sm:inline">Executive Memo</span>
            </Button>
            <Button variant="outline" onClick={() => setPair(idB, idA)}
              className="h-8 bg-card px-3 text-xs"
              aria-label="Swap baseline and candidate"
              title="Swap baseline and candidate">
              <ArrowLeftRight className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Swap</span>
            </Button>
            <Button variant="outline" onClick={copyShareUrl} className="h-8 bg-card px-3 text-xs">
              <Copy className="size-3.5 text-muted-foreground" />
              Share
            </Button>
            <Button variant="outline" onClick={exportComparisonJson} className="h-8 bg-card px-3 text-xs">
              <Download className="size-3.5 text-muted-foreground" /> JSON
            </Button>
          </div>
        )}
      </div>

      {/* Selector cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {selectors.map((s) => (
          <div key={s.key} className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Dot color={s.color} />
                {s.tag}
              </span>
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                Model {s.key}
              </span>
            </div>
            <ModelPicker
              models={models}
              value={s.value}
              onValueChange={(id) => (s.key === "A" ? setPair(id, idB) : setPair(idA, id))}
              isItemDisabled={(m) => m.id === s.other}
              filter={evaluatedOnly[s.key] ? evalFilter : undefined}
              searchPlaceholder={
                evaluatedOnly[s.key] ? `Search ${evaluatedCount} evaluated models…` : "Search all models…"
              }
              aria-label={`${s.tag} (Model ${s.key})`}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              {s.count > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-success" />
                  {s.count} benchmark{s.count === 1 ? "" : "s"} evaluated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/40" />
                  No completed evaluations
                </span>
              )}
              <button
                type="button"
                aria-pressed={evaluatedOnly[s.key]}
                onClick={() => setEvaluatedOnly((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  evaluatedOnly[s.key]
                    ? "border-brand/20 bg-brand/10 text-brand"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
                title={
                  evaluatedOnly[s.key]
                    ? `Listing only the ${evaluatedCount} models with completed evaluations`
                    : `Listing all ${models.length} models`
                }
              >
                <SlidersHorizontal className="size-3" aria-hidden />
                {evaluatedOnly[s.key] ? `Evaluated only · ${evaluatedCount}` : `All models · ${models.length}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {a && b ? (
        <div className="space-y-6">
          {/* Benchmark accuracy */}
          <section className={CARD}>
            <CardHeader
              icon={GitCompareArrows}
              title="Benchmark Accuracy"
              meta={
                rows.length > 0
                  ? `${rows.length} shared benchmark${rows.length === 1 ? "" : "s"} · Wilson 95% CI`
                  : undefined
              }
            />

            {rows.length === 0 ? (
              <NoSharedBenchmarks
                a={a}
                b={b}
                benchA={[...evA.values()].map((e) => e.benchmark_name).sort()}
                benchB={[...evB.values()].map((e) => e.benchmark_name).sort()}
                suggestions={suggestPairs(index, models, modelById, idA, idB)}
                modelById={modelById}
                onPick={setPair}
              />
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <PooledTile label="A" model={a} color={colorA} pooled={pooledA} />
                  <PooledTile label="B" model={b} color={colorB} pooled={pooledB} />
                  <div className="col-span-2 min-w-0 rounded-xl border border-border bg-muted/30 p-4 lg:col-span-1">
                    <p className="text-xs text-muted-foreground">Overall verdict</p>
                    <div className="mt-3">
                      <VerdictChip verdict={overall} />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/80">
                      {overall === "a" || overall === "b"
                        ? `${formatModelName((overall === "a" ? a : b).name)} is significantly more accurate across the shared benchmarks.`
                        : overall === "tie"
                          ? "Pooled intervals overlap: no significant overall accuracy difference."
                          : "Not enough data for a pooled interval."}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                      A leads {winsA} · B leads {winsB} · {ties} overlap
                    </p>
                  </div>
                </div>

                <BenchmarkTable rows={rows} a={a} b={b} colorA={colorA} colorB={colorB} />

                <div className="mt-4 space-y-1 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <p>
                    Bars show each model&apos;s Wilson 95% interval; the shaded band is where they overlap.
                    Overlapping intervals are flagged as not statistically distinguishable. Click a score for
                    per-question results.
                  </p>
                  {judgedShared.length > 0 && (
                    <p>
                      Pooled accuracy excludes LLM-judge benchmarks ({judgedShared.join(", ")}); their graded scores
                      are not pass/fail proportions.
                    </p>
                  )}
                  {(onlyA.length > 0 || onlyB.length > 0) && (
                    <p>
                      Not compared (single-model only):{" "}
                      {onlyA.length > 0 && (
                        <>
                          A: <span className="text-foreground/80">{onlyA.join(", ")}</span>
                        </>
                      )}
                      {onlyA.length > 0 && onlyB.length > 0 && " · "}
                      {onlyB.length > 0 && (
                        <>
                          B: <span className="text-foreground/80">{onlyB.join(", ")}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>

          {rows.length > 0 && (
            <div className={cn("grid gap-6", rows.length >= 3 && "lg:grid-cols-2")}>
              {rows.length >= 3 && (
                <section className={cn(CARD, "min-w-0")}>
                  <CardHeader icon={RadarIcon} title="Capability Radar" meta="Accuracy % per benchmark" />
                  <Suspense fallback={<Skeleton className="h-[330px] rounded-xl" />}>
                    <BenchmarkRadarChart
                      nameA={formatModelName(a.name)}
                      nameB={formatModelName(b.name)}
                      colorA={colorA}
                      colorB={colorB}
                      height={330}
                      data={rows.map((r) => ({
                        benchmark: r.name,
                        modelA: r.a.accuracy ?? 0,
                        modelB: r.b.accuracy ?? 0,
                        modelALower: r.a.lower,
                        modelAUpper: r.a.upper,
                        modelBLower: r.b.lower,
                        modelBUpper: r.b.upper,
                      }))}
                    />
                  </Suspense>
                </section>
              )}

              <section className={cn(CARD, "min-w-0")}>
                <CardHeader icon={Gauge} title="Latency & Cost" meta="Averaged over shared benchmarks" />
                <ModelColumnLabels first="Metric" a={a} b={b} colorA={colorA} colorB={colorB} />
                <MetricRow
                  label="Mean latency"
                  a={formatLatency(perf.latencyA)}
                  b={formatLatency(perf.latencyB)}
                  winner={better(perf.latencyA, perf.latencyB, true)}
                />
                <MetricRow
                  label="P95 latency"
                  a={formatLatency(perf.p95A)}
                  b={formatLatency(perf.p95B)}
                  winner={better(perf.p95A, perf.p95B, true)}
                />
                <MetricRow
                  label="Throughput"
                  a={perf.tpsA === null ? "—" : `${formatNumber(perf.tpsA)} tok/s`}
                  b={perf.tpsB === null ? "—" : `${formatNumber(perf.tpsB)} tok/s`}
                  winner={better(perf.tpsA, perf.tpsB, false)}
                />
                <MetricRow
                  label="Failure rate"
                  a={formatPct(perf.failA)}
                  b={formatPct(perf.failB)}
                  winner={better(perf.failA, perf.failB, true)}
                />
                <MetricRow
                  label="Tokens / question"
                  a={perf.tokQA === null ? "—" : formatNumber(perf.tokQA)}
                  b={perf.tokQB === null ? "—" : formatNumber(perf.tokQB)}
                  winner={better(perf.tokQA, perf.tokQB, true)}
                />
                <MetricRow
                  label="Recorded eval cost"
                  a={formatCost(perf.costA)}
                  b={formatCost(perf.costB)}
                  winner={better(perf.costA, perf.costB, true)}
                />
              </section>
            </div>
          )}

          {/* Specifications */}
          <section className={CARD}>
            <CardHeader icon={GitCompareArrows} title="Specifications & Pricing" />
            <ModelColumnLabels first="Parameter" a={a} b={b} colorA={colorA} colorB={colorB} />
            <MetricRow label="Category" a={a.category} b={b.category} winner="tie" />
            <MetricRow
              label="Context window"
              a={formatContext(a.context_window)}
              b={formatContext(b.context_window)}
              winner={better(a.context_window, b.context_window, false)}
            />
            <MetricRow
              label="Input price"
              a={formatPricePerMillion(a.pricing_input)}
              b={formatPricePerMillion(b.pricing_input)}
              winner={better(a.pricing_input, b.pricing_input, true)}
            />
            <MetricRow
              label="Output price"
              a={formatPricePerMillion(a.pricing_output)}
              b={formatPricePerMillion(b.pricing_output)}
              winner={better(a.pricing_output, b.pricing_output, true)}
            />
          </section>
        </div>
      ) : (
        <div className={cn(CARD, "flex flex-col items-center justify-center px-6 py-20 text-center")}>
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <GitCompareArrows className="size-6" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-foreground">Select two models</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Choose a baseline and a candidate above to compare benchmark accuracy, latency and pricing.
          </p>
        </div>
      )}

      {a && b && isReportOpen && (
        <Suspense fallback={null}>
          <ExecutiveReportModal
            isOpen={isReportOpen}
            onClose={() => setIsReportOpen(false)}
            overall={overall}
            modelA={{
              name: formatModelName(a.name),
              vendor: vendorName(a),
              context: a.context_window,
              pricingInput: a.pricing_input,
              pricingOutput: a.pricing_output,
              pooled: { accuracy: pooledA.accuracy, lower: pooledA.lower, upper: pooledA.upper },
              meanLatencyMs: perf.latencyA,
            }}
            modelB={{
              name: formatModelName(b.name),
              vendor: vendorName(b),
              context: b.context_window,
              pricingInput: b.pricing_input,
              pricingOutput: b.pricing_output,
              pooled: { accuracy: pooledB.accuracy, lower: pooledB.lower, upper: pooledB.upper },
              meanLatencyMs: perf.latencyB,
            }}
            benchmarks={rows.map((r) => ({ benchmark: r.name, a: r.a, b: r.b, verdict: r.verdict }))}
          />
        </Suspense>
      )}
    </div>
  );
}
