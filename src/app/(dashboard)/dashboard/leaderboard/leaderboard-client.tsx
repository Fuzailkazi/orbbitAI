"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Trophy, SlidersHorizontal, Info, BarChart3, Download, Plus, X,
  Search, ArrowUpRight, ArrowDownRight, Minus, Sparkles, Zap, ShieldCheck,
  RefreshCw, CheckCircle2,
} from "lucide-react";
import { TopModelsChart } from "@/components/charts/top-models-chart";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatCost,
  formatLatency,
  formatModelName,
  formatNumber,
  formatPricePerMillion,
  formatVendor,
  resolveCI,
  scoredQuestionCount,
  type ResolvedCI,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalRow {
  id: string;
  accuracy: number | null;
  accuracy_ci_lower: number | null;
  accuracy_ci_upper: number | null;
  avg_latency_ms: number | null;
  tokens_per_second: number | null;
  questions_evaluated?: number | null;
  questions_correct?: number | null;
  failure_rate?: number | null;
  models: {
    id: string;
    name: string;
    vendor: string;
    category: string | null;
    pricing_input: number | null;
  } | null;
  benchmarks: { id: string; name: string; category: string } | null;
}

type RankingMode = "accuracy" | "value";

/** Independent 0–100 slider values. The composite normalizes by their sum. */
interface Weights {
  quality: number;
  cost: number;
  speed: number;
}

interface LeaderboardView {
  benchmark: string;
  mode: RankingMode;
  weights: Weights;
  search: string;
}

interface Preset extends Weights {
  label: string;
  desc: string;
  custom?: boolean;
}

/** A completed evaluation with its joins present and accuracy recorded. */
interface Row {
  ev: EvalRow & { models: NonNullable<EvalRow["models"]>; benchmarks: NonNullable<EvalRow["benchmarks"]> };
  accuracy: number;
  ci: ResolvedCI;
  price: number;
  latency: number | null;
  n: number | null;
}

interface RankedRow extends Row {
  score: number;
}

// ---------------------------------------------------------------------------
// Constants & pure helpers
// ---------------------------------------------------------------------------

/** CLAUDE.md rule 6 defaults: quality 0.5, cost 0.25, speed 0.25. */
const DEFAULT_WEIGHTS: Weights = { quality: 50, cost: 25, speed: 25 };
const WEIGHT_KEYS = ["quality", "cost", "speed"] as const;
const VERIFIED_MIN_N = 20;
const URL_DEBOUNCE_MS = 250;

const BUILT_IN_PRESETS: Preset[] = [
  { label: "Quality", quality: 80, cost: 10, speed: 10, desc: "Weights precision and reasoning accuracy" },
  { label: "Balanced", quality: 50, cost: 25, speed: 25, desc: "Default trade-off" },
  { label: "Speed & Cost", quality: 20, cost: 50, speed: 30, desc: "Prioritizes low token cost and latency" },
];

const SLIDERS: Array<{ key: keyof Weights; label: string; hint: string }> = [
  { key: "quality", label: "Quality", hint: "Benchmark accuracy" },
  { key: "cost", label: "Cost", hint: "Input price per 1M tokens" },
  { key: "speed", label: "Speed", hint: "Average latency" },
];

function clampWeight(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseWeight(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? clampWeight(n) : fallback;
}

function parseView(params: { get(name: string): string | null }): LeaderboardView {
  return {
    benchmark: params.get("benchmark")?.trim() || "all",
    mode: params.get("mode") === "value" ? "value" : "accuracy",
    weights: {
      quality: parseWeight(params.get("quality"), DEFAULT_WEIGHTS.quality),
      cost: parseWeight(params.get("cost"), DEFAULT_WEIGHTS.cost),
      speed: parseWeight(params.get("speed"), DEFAULT_WEIGHTS.speed),
    },
    search: params.get("q") ?? "",
  };
}

function sameWeights(a: Weights, b: Weights): boolean {
  return a.quality === b.quality && a.cost === b.cost && a.speed === b.speed;
}

function sameView(a: LeaderboardView, b: LeaderboardView): boolean {
  return a.benchmark === b.benchmark && a.mode === b.mode && a.search === b.search && sameWeights(a.weights, b.weights);
}

function setParam(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) params.delete(key);
  else params.set(key, value);
}

function weightSum(w: Weights): number {
  return w.quality + w.cost + w.speed;
}

function valueScore(row: Row, weights: Weights, maxAcc: number, maxPrice: number, maxLatency: number): number {
  const q = maxAcc > 0 ? row.accuracy / maxAcc : 0;
  const logP = Math.log10(1 + row.price);
  const logMaxP = Math.log10(1 + Math.max(maxPrice, 1));
  const c = logMaxP > 0 ? Math.max(0, 1 - logP / logMaxP) : 1;
  const s =
    row.latency === null
      ? 0
      : maxLatency > 0
        ? Math.max(0, 1 - Math.sqrt(row.latency) / Math.sqrt(maxLatency))
        : 1;
  // Weights are independent sliders (each 0–100, set separately by the user) —
  // normalize by their sum here so the composite score is still well-formed,
  // without ever forcing the sliders themselves to move each other.
  const sum = weightSum(weights) || 1;
  return ((weights.quality * q + weights.cost * c + weights.speed * s) / sum) * 100;
}

function toRow(ev: EvalRow): Row | null {
  if (!ev.models || !ev.benchmarks) return null;
  const ci = resolveCI(ev);
  if (ci.accuracy === null) return null;
  const latency = typeof ev.avg_latency_ms === "number" && ev.avg_latency_ms > 0 ? ev.avg_latency_ms : null;
  return {
    ev: { ...ev, models: ev.models, benchmarks: ev.benchmarks },
    accuracy: ci.accuracy,
    ci,
    price: ev.models.pricing_input ?? 0,
    latency,
    // Graded prompts (the CI's n), not attempted ones.
    n: scoredQuestionCount(ev) > 0 ? scoredQuestionCount(ev) : null,
  };
}

function isVerified(row: Row): boolean {
  return (row.n ?? 0) >= VERIFIED_MIN_N;
}

/** Best run per model, prioritizing statistically verified runs (n ≥ 20). */
function bestPerModel(rows: Row[]): Row[] {
  const byModel = new Map<string, Row>();
  for (const row of rows) {
    const existing = byModel.get(row.ev.models.id);
    if (!existing) {
      byModel.set(row.ev.models.id, row);
      continue;
    }
    const current = isVerified(row);
    const previous = isVerified(existing);
    if (current && !previous) byModel.set(row.ev.models.id, row);
    else if (current === previous && row.accuracy > existing.accuracy) byModel.set(row.ev.models.id, row);
  }
  return Array.from(byModel.values());
}

function pickBest<T>(items: T[], metric: (item: T) => number): T | null {
  let best: T | null = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const v = metric(item);
    if (v > bestValue) {
      best = item;
      bestValue = v;
    }
  }
  return best;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvFileName(benchmark: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `orbbit_leaderboard_${benchmark.replace(/[^a-z0-9-]+/gi, "_")}_${stamp}.csv`;
}

// ---------------------------------------------------------------------------
// Custom presets (per-viewer convenience in localStorage)
// ---------------------------------------------------------------------------

const PRESET_STORAGE_KEY = "orbbit_value_presets";
const PRESET_EVENT = "orbbit:value-presets";

function subscribePresets(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PRESET_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PRESET_EVENT, onChange);
  };
}

function readPresetsRaw(): string | null {
  try {
    return window.localStorage.getItem(PRESET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readPresetsServer(): string | null {
  return null;
}

/** Stored as 0–1 fractions (legacy format); exposed as 0–100 slider values. */
function parsePresets(raw: string | null): Preset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Preset[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.label !== "string" || !rec.label.trim()) continue;
      const w = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? clampWeight(v * 100) : 0);
      out.push({
        label: rec.label.trim(),
        quality: w(rec.quality),
        cost: w(rec.cost),
        speed: w(rec.speed),
        desc: "Custom weight preset",
        custom: true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Returns false when storage is unavailable (private mode, blocked site data). */
function writePresets(presets: Preset[]): boolean {
  try {
    const stored = presets.map((p) => ({
      label: p.label,
      quality: p.quality / 100,
      cost: p.cost / 100,
      speed: p.speed / 100,
      desc: p.desc,
    }));
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new Event(PRESET_EVENT));
    return true;
  } catch {
    // Storage unavailable (private mode, blocked site data) — presets are a convenience only.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sticky model column (phones only): the table scrolls sideways inside its card, so the
// model name stays pinned with an opaque surface and an edge shadow once scrolled.
// ---------------------------------------------------------------------------

const STICKY_CELL =
  "max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-card max-md:group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] max-md:transition-shadow";
const STICKY_HEAD = "max-md:sticky max-md:left-0 max-md:z-20 max-md:bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]";
const STICKY_EDGE =
  "max-md:shadow-[inset_-1px_0_0_var(--border),8px_0_12px_-8px_color-mix(in_oklab,var(--foreground)_30%,transparent)]";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaderboardClient({ evaluations }: { evaluations: EvalRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  // URL search params are the source of truth (invariant 5). Local state mirrors them so
  // sliders stay responsive; writes go back to the URL via history.replaceState (debounced
  // for continuous inputs), and external URL changes (links, back/forward) re-sync here.
  const [view, setView] = useState<LeaderboardView>(() => parseView(searchParams));
  const [urlSync, setUrlSync] = useState({ seen: query, written: query });
  if (query !== urlSync.seen) {
    setUrlSync({ seen: query, written: urlSync.written });
    if (query !== urlSync.written) {
      const fromUrl = parseView(searchParams);
      if (!sameView(fromUrl, view)) setView(fromUrl);
    }
  }

  const [chartMetric, setChartMetric] = useState<RankingMode>(view.mode);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tableScrolled, setTableScrolled] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const urlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stripRef = useRef<HTMLDivElement>(null);

  const customPresets = parsePresets(useSyncExternalStore(subscribePresets, readPresetsRaw, readPresetsServer));

  // Cache Components keeps recently visited routes mounted but hidden; close the preset
  // popover when this route is hidden so it doesn't reappear open on back/forward.
  useLayoutEffect(() => () => setPresetOpen(false), []);

  function updateView(patch: Partial<LeaderboardView>, delay = 0) {
    const next: LeaderboardView = { ...view, ...patch };
    setView(next);
    clearTimeout(urlTimer.current);
    const ownPath = pathname;
    const write = () => {
      // Never write onto another page if the user navigated away during the debounce.
      if (window.location.pathname !== ownPath) return;
      const params = new URLSearchParams(window.location.search);
      setParam(params, "benchmark", next.benchmark === "all" ? null : next.benchmark);
      setParam(params, "mode", next.mode === "accuracy" ? null : next.mode);
      const isDefault = sameWeights(next.weights, DEFAULT_WEIGHTS);
      for (const key of WEIGHT_KEYS) setParam(params, key, isDefault ? null : String(next.weights[key]));
      setParam(params, "q", next.search.trim() ? next.search : null);
      const qs = params.toString();
      setUrlSync((s) => ({ ...s, written: qs }));
      window.history.replaceState(null, "", qs ? `${ownPath}?${qs}` : ownPath);
    };
    if (delay > 0) urlTimer.current = setTimeout(write, delay);
    else write();
  }

  // Bring a deep-linked benchmark tab into view once on mount.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !active) return;
    const overflowRight = active.offsetLeft + active.offsetWidth - (strip.scrollLeft + strip.clientWidth);
    if (overflowRight > 0) strip.scrollLeft = active.offsetLeft - 8;
  }, []);

  async function syncOpenRouter() {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/models/sync", { method: "POST" });
      const json: { data?: { totalDiscovered?: number; newModelsAdded?: number }; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      toast.success(`Synced ${json.data?.totalDiscovered ?? 0} models from OpenRouter`, {
        description: `${json.data?.newModelsAdded ?? 0} newly added`,
      });
    } catch (err) {
      toast.error("Couldn't sync models", {
        description: err instanceof Error && err.message ? err.message : "Please try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  // ---- Derived data (React Compiler memoizes; no manual useMemo) ----
  const allRows = evaluations.map(toRow).filter((r): r is Row => r !== null);
  const benchmarkNames = [...new Set(allRows.map((r) => r.ev.benchmarks.name))].sort((a, b) => a.localeCompare(b));
  const selectedBenchmark = view.benchmark !== "all" && benchmarkNames.includes(view.benchmark) ? view.benchmark : "all";
  const filtered = selectedBenchmark === "all" ? allRows : allRows.filter((r) => r.ev.benchmarks.name === selectedBenchmark);
  const unique = bestPerModel(filtered);

  const maxAcc = Math.max(...unique.map((r) => r.accuracy), 1);
  const maxPrice = Math.max(...unique.map((r) => r.price), 0.01);
  const maxLatency = Math.max(...unique.map((r) => r.latency ?? 0), 1);
  const weights = view.weights;
  const totalWeight = weightSum(weights);

  const scored: RankedRow[] = unique.map((r) => ({ ...r, score: valueScore(r, weights, maxAcc, maxPrice, maxLatency) }));
  const byAccuracy = [...scored].sort((a, b) => b.accuracy - a.accuracy);
  const baselineRanks = new Map(byAccuracy.map((r, i) => [r.ev.models.id, i + 1]));
  const sorted = view.mode === "accuracy" ? byAccuracy : [...scored].sort((a, b) => b.score - a.score);
  const needle = view.search.trim().toLowerCase();
  const ranked = needle
    ? sorted.filter(
        (r) =>
          r.ev.models.name.toLowerCase().includes(needle) ||
          r.ev.models.vendor.toLowerCase().includes(needle) ||
          formatVendor(r.ev.models.vendor).toLowerCase().includes(needle)
      )
    : sorted;

  // Highlight shelf — derived from the current benchmark selection so every figure is traceable.
  const topAccuracy = byAccuracy[0] ?? null;
  const topValue = pickBest(scored, (r) => r.score);
  const topEfficiency = pickBest(unique, (r) =>
    valueScore(r, { quality: 1, cost: 1, speed: 0 }, maxAcc, maxPrice, maxLatency)
  );
  const fastest = pickBest(
    unique.filter((r) => r.latency !== null),
    (r) => -(r.latency ?? Infinity)
  );
  const highlights: Array<{ badge: string; row: RankedRow | Row; detail: string }> = [];
  if (topAccuracy) {
    highlights.push({
      badge: "Accuracy",
      row: topAccuracy,
      detail: topAccuracy.n ? `n=${formatNumber(topAccuracy.n)} • ${formatLatency(topAccuracy.latency)}` : formatLatency(topAccuracy.latency),
    });
  }
  if (topValue) {
    highlights.push({
      badge: "Value",
      row: topValue,
      detail: `Value score ${topValue.score.toFixed(1)} • ${formatPricePerMillion(topValue.price)}`,
    });
  }
  if (topEfficiency) {
    highlights.push({
      badge: "Efficiency",
      row: topEfficiency,
      detail: `${formatPricePerMillion(topEfficiency.price)} input • ${formatLatency(topEfficiency.latency)}`,
    });
  }
  if (fastest) {
    highlights.push({
      badge: "Speed",
      row: fastest,
      detail: fastest.ev.tokens_per_second
        ? `${formatLatency(fastest.latency)} avg • ${formatNumber(fastest.ev.tokens_per_second)} TPS`
        : `${formatLatency(fastest.latency)} avg latency`,
    });
  }
  // When one model leads several categories, show it once with the combined badges
  // (e.g. "Accuracy · Value") instead of repeating identical cards.
  const shelf: Array<{ badge: string; row: RankedRow | Row; detail: string }> = [];
  for (const h of highlights) {
    const existing = shelf.find((s) => s.row.ev.models.id === h.row.ev.models.id);
    if (existing) existing.badge = `${existing.badge} · ${h.badge}`;
    else shelf.push({ ...h });
  }
  const showShelf = unique.length >= 2 && shelf.length > 0;
  const shelfCols = shelf.length >= 4 ? "lg:grid-cols-4" : shelf.length === 3 ? "lg:grid-cols-3" : "";

  const presets: Preset[] = [...BUILT_IN_PRESETS, ...customPresets];

  function setMode(mode: RankingMode) {
    setChartMetric(mode);
    updateView({ mode });
  }

  function setWeight(key: keyof Weights, value: number) {
    // Independent slider: only this weight changes. The composite score normalizes by the
    // sum of all three, so the ranking still makes sense whatever the other two are set to.
    updateView({ weights: { ...weights, [key]: clampWeight(value) } }, URL_DEBOUNCE_MS);
  }

  function saveCustomPreset() {
    const label = presetName.trim();
    if (!label) return;
    const next: Preset = { label, ...weights, desc: "Custom weight preset", custom: true };
    const others = customPresets.filter((p) => p.label.toLowerCase() !== label.toLowerCase());
    if (!writePresets([...others, next])) {
      toast.error("Couldn't save preset", { description: "Browser storage is unavailable in this window." });
      return;
    }
    toast.success(`Saved preset “${label}”`);
    setPresetName("");
    setPresetOpen(false);
  }

  function removeCustomPreset(label: string) {
    if (!writePresets(customPresets.filter((p) => p.label !== label))) {
      toast.error("Couldn't delete preset", { description: "Browser storage is unavailable in this window." });
      return;
    }
    toast.success(`Deleted preset “${label}”`);
  }

  function exportLeaderboardCsv() {
    const headers = [
      "Rank", "Model", "Vendor", "Benchmark", "Value Score", "Accuracy (%)", "CI Lower (%)", "CI Upper (%)",
      "Questions (n)", "Avg Latency (ms)", "Tokens/sec", "Input $/1M",
    ];
    const rows = ranked.map((r, i) => [
      i + 1,
      r.ev.models.name,
      formatVendor(r.ev.models.vendor),
      r.ev.benchmarks.name,
      r.score.toFixed(1),
      r.accuracy.toFixed(1),
      r.ci.lower?.toFixed(1),
      r.ci.upper?.toFixed(1),
      r.n,
      r.latency,
      r.ev.tokens_per_second,
      r.price,
    ]);
    const csv = [headers, ...rows].map((line) => line.map(csvCell).join(",")).join("\n");
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = csvFileName(selectedBenchmark);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? "row" : "rows"} to CSV`);
    } catch {
      toast.error("Couldn't export the leaderboard");
    }
  }

  const tabClass = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98] ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
    }`;

  const segmentClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
      active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16 font-sans">
      {/* Header with Title & Search */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Model Leaderboard</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Empirical accuracy rankings with dynamic trade-offs. Adjust Quality, Latency, and Cost to re-rank models in real time.
          </p>
        </div>

        <div className="flex w-full items-center gap-2.5 md:w-auto">
          <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search models or vendors"
              placeholder="Search model, vendor…"
              value={view.search}
              onChange={(e) => updateView({ search: e.target.value }, URL_DEBOUNCE_MS)}
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            type="button"
            onClick={syncOpenRouter}
            disabled={isSyncing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            title="Sync newest models directly from OpenRouter API"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-brand" : "text-muted-foreground"}`} />
            <span>{isSyncing ? "Syncing…" : "Sync Models"}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Selector: scrollable filter bar with a fade edge */}
      <div className="relative rounded-xl border border-border bg-muted/50 shadow-sm">
        <div
          ref={stripRef}
          role="group"
          aria-label="Filter by benchmark"
          className="flex items-center gap-1.5 overflow-x-auto p-1.5 pr-10 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={selectedBenchmark === "all"}
            onClick={() => updateView({ benchmark: "all" })}
            className={tabClass(selectedBenchmark === "all")}
          >
            All Benchmarks
            <span
              className={`font-mono text-xs tabular-nums ${
                selectedBenchmark === "all" ? "text-primary-foreground/70" : "text-muted-foreground/80"
              }`}
            >
              {allRows.length}
            </span>
          </button>
          {benchmarkNames.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={selectedBenchmark === name}
              onClick={() => updateView({ benchmark: name })}
              className={tabClass(selectedBenchmark === name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Ranking Mode Switcher */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground">Ranking mode</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {view.mode === "accuracy" ? "Accuracy" : "Value"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {view.mode === "accuracy"
                ? "Ranked strictly by empirical benchmark precision."
                : "Ranked dynamically by multi-criteria preferences (Quality, Cost, Speed)."}
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Ranking mode"
          className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-1 text-sm"
        >
          <button
            type="button"
            aria-pressed={view.mode === "accuracy"}
            onClick={() => setMode("accuracy")}
            className={`flex-1 justify-center sm:flex-none ${segmentClass(view.mode === "accuracy")}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Accuracy
          </button>
          <button
            type="button"
            aria-pressed={view.mode === "value"}
            onClick={() => setMode("value")}
            className={`flex-1 justify-center sm:flex-none ${segmentClass(view.mode === "value")}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Value
          </button>
        </div>
      </div>

      {/* Highlight shelf */}
      {showShelf && (
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${shelfCols}`}>
          {shelf.map(({ badge, row, detail }) => (
            <Link
              key={row.ev.models.id}
              href={`/dashboard/models/${row.ev.models.id}`}
              className="group min-w-0 rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/15 hover:shadow-sm sm:p-6"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="min-w-0 text-xs font-medium leading-snug text-muted-foreground">{badge}</span>
                <span className="ml-2 mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
              </div>
              <p
                className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand"
                title={row.ev.models.name}
              >
                {formatModelName(row.ev.models.name)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{formatVendor(row.ev.models.vendor)}</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 border-t border-border pt-3">
                <AccuracyWithCI
                  accuracy={row.ci.accuracy}
                  lower={row.ci.lower}
                  upper={row.ci.upper}
                  variant="stacked"
                  size="lg"
                />
                <span className="truncate text-xs text-muted-foreground">{row.ev.benchmarks.name}</span>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Weight Preferences Panel */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Weight preferences</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each slider is independent (0–100). The value score normalizes by their sum.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={presetOpen} onOpenChange={setPresetOpen}>
              <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98]">
                <Plus className="h-4 w-4 text-muted-foreground" /> Save Preset
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 rounded-xl p-3">
                <form
                  className="flex flex-col gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveCustomPreset();
                  }}
                >
                  <label htmlFor="preset-name" className="text-xs font-medium text-foreground">
                    Preset name
                  </label>
                  <input
                    id="preset-name"
                    autoFocus
                    value={presetName}
                    maxLength={40}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g. Budget reasoning"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    Q {weights.quality} · C {weights.cost} · S {weights.speed}
                  </p>
                  <button
                    type="submit"
                    disabled={!presetName.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    Save preset
                  </button>
                </form>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={exportLeaderboardCsv}
              disabled={ranked.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-muted-foreground" /> Export CSV
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-6 flex flex-wrap gap-2">
          {presets.map((p) => {
            const isActive = sameWeights(weights, p);
            return (
              <span key={`${p.custom ? "custom" : "builtin"}-${p.label}`} className="relative inline-flex">
                <button
                  type="button"
                  title={p.desc}
                  aria-pressed={isActive}
                  onClick={() => updateView({ weights: { quality: p.quality, cost: p.cost, speed: p.speed } })}
                  className={`rounded-lg px-4 py-2 text-sm shadow-sm transition-all active:scale-[0.98] ${
                    p.custom ? "pr-8" : ""
                  } ${
                    isActive
                      ? "bg-primary font-medium text-primary-foreground"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
                {p.custom && (
                  <button
                    type="button"
                    aria-label={`Delete preset ${p.label}`}
                    onClick={() => removeCustomPreset(p.label)}
                    className={`absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md transition-colors ${
                      isActive
                        ? "text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Faders */}
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          {SLIDERS.map(({ key, label, hint }) => (
            <WeightSlider
              key={key}
              id={`weight-${key}`}
              label={label}
              hint={hint}
              value={weights[key]}
              share={totalWeight > 0 ? Math.round((weights[key] / totalWeight) * 100) : 0}
              onChange={(v) => setWeight(key, v)}
            />
          ))}
        </div>
        {totalWeight === 0 && (
          <p className="mt-4 text-xs font-medium text-warning">
            All weights are 0 — raise at least one slider to compute value scores.
          </p>
        )}
      </div>

      {/* Top Models Chart */}
      {ranked.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-6 flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Top Models</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Metric:</span>
              <div role="group" aria-label="Chart metric" className="flex items-center rounded-lg border border-border bg-muted/50 p-1 text-xs">
                <button
                  type="button"
                  aria-pressed={chartMetric === "value"}
                  onClick={() => setChartMetric("value")}
                  className={`rounded-md px-3 py-1 transition-all ${
                    chartMetric === "value" ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Value
                </button>
                <button
                  type="button"
                  aria-pressed={chartMetric === "accuracy"}
                  onClick={() => setChartMetric("accuracy")}
                  className={`rounded-md px-3 py-1 transition-all ${
                    chartMetric === "accuracy" ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Accuracy
                </button>
              </div>
            </div>
          </div>
          <TopModelsChart
            data={ranked.slice(0, 10).map((r) => ({
              name: r.ev.models.name,
              score: chartMetric === "value" ? r.score : r.accuracy,
              vendor: r.ev.models.vendor,
              ciLower: r.ci.lower,
              ciUpper: r.ci.upper,
              benchmark: r.ev.benchmarks.name,
              n: r.n,
              href: `/dashboard/evaluations/${r.ev.id}`,
            }))}
            label={chartMetric === "value" ? "Value Score" : "Accuracy %"}
            metric={chartMetric === "value" ? "score" : "accuracy"}
            height={300}
          />
        </div>
      )}

      {/* Ranked Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto" onScroll={(e) => setTableScrolled(e.currentTarget.scrollLeft > 0)}>
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th scope="col" className="w-16 px-4 py-4 sm:px-6 text-left text-xs font-medium uppercase text-muted-foreground">Rank</th>
                <th
                  scope="col"
                  className={cn(
                    "px-4 py-4 sm:px-6 text-left text-xs font-medium uppercase text-muted-foreground",
                    STICKY_HEAD,
                    tableScrolled && STICKY_EDGE
                  )}
                >
                  Model
                </th>
                <th scope="col" className="px-4 py-4 sm:px-6 text-left text-xs font-medium uppercase text-muted-foreground">
                  Accuracy <span className="normal-case text-muted-foreground/80">(95% CI)</span>
                </th>
                <th scope="col" className="px-4 py-4 sm:px-6 text-right text-xs font-medium uppercase text-muted-foreground">Value score</th>
                <th scope="col" className="px-4 py-4 sm:px-6 text-right text-xs font-medium uppercase text-muted-foreground">Latency</th>
                <th scope="col" className="px-4 py-4 sm:px-6 text-right text-xs font-medium uppercase text-muted-foreground">Speed</th>
                <th scope="col" className="px-4 py-4 sm:px-6 text-right text-xs font-medium uppercase text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 sm:px-6 text-center text-sm text-muted-foreground">
                    {needle
                      ? `No models match “${view.search.trim()}”.`
                      : "No completed evaluations for this benchmark yet."}
                  </td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {ranked.map((r, i) => {
                  const currentRank = i + 1;
                  const baseRank = baselineRanks.get(r.ev.models.id) ?? currentRank;
                  const rankDelta = baseRank - currentRank;
                  const { lower, upper } = r.ci;

                  return (
                    <motion.tr
                      layout
                      key={r.ev.models.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      className="group transition-colors hover:bg-muted/50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted font-mono text-sm font-medium tabular-nums text-foreground">
                            {currentRank}
                          </div>
                          {rankDelta > 0 ? (
                            <span className="flex items-center font-mono text-xs font-medium tabular-nums text-success" title={`Up ${rankDelta} vs accuracy rank`}>
                              <ArrowUpRight className="mr-0.5 h-3 w-3" />
                              {rankDelta}
                            </span>
                          ) : rankDelta < 0 ? (
                            <span className="flex items-center font-mono text-xs font-medium tabular-nums text-destructive" title={`Down ${Math.abs(rankDelta)} vs accuracy rank`}>
                              <ArrowDownRight className="mr-0.5 h-3 w-3" />
                              {Math.abs(rankDelta)}
                            </span>
                          ) : (
                            <span className="flex items-center text-xs text-muted-foreground" title="Same as accuracy rank">
                              <Minus className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className={cn("px-4 py-4 sm:px-6 max-md:max-w-[200px]", STICKY_CELL, tableScrolled && STICKY_EDGE)}>
                        <Link
                          href={`/dashboard/models/${r.ev.models.id}`}
                          title={r.ev.models.name}
                          className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-brand max-md:block max-md:truncate"
                        >
                          {formatModelName(r.ev.models.name)}
                        </Link>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-xs text-muted-foreground">{formatVendor(r.ev.models.vendor)}</span>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30 max-md:hidden" />
                          <span className="text-xs capitalize text-muted-foreground max-md:hidden">{r.ev.models.category || "general"}</span>
                          {selectedBenchmark === "all" && (
                            <>
                              <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30" />
                              <span className="truncate text-xs text-muted-foreground">{r.ev.benchmarks.name}</span>
                            </>
                          )}
                        </div>
                        {/* Phones: the metric columns start off-screen, so surface the key figure here. */}
                        <div className="mt-1.5 flex items-baseline gap-1.5 md:hidden">
                          <AccuracyWithCI accuracy={r.ci.accuracy} lower={lower} upper={upper} size="xs" />
                          {view.mode === "value" && (
                            <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                              · value {r.score.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 sm:px-6">
                        <div className="max-w-[200px] space-y-2">
                          <Link
                            href={`/dashboard/evaluations/${r.ev.id}`}
                            className="rounded-sm hover:underline hover:decoration-muted-foreground/40 hover:underline-offset-4"
                            title="View per-question results"
                          >
                            <AccuracyWithCI accuracy={r.ci.accuracy} lower={lower} upper={upper} ciFormat="range" />
                          </Link>
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                            {lower !== null && upper !== null && (
                              <div
                                className="absolute h-full rounded-full bg-muted-foreground/30"
                                style={{
                                  left: `${Math.max(0, lower)}%`,
                                  width: `${Math.max(0, Math.min(100, upper) - Math.max(0, lower))}%`,
                                }}
                              />
                            )}
                            <div className="absolute h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.accuracy)}%` }} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {r.n !== null && <span className="font-mono tabular-nums">n={formatNumber(r.n)}</span>}
                            {isVerified(r) ? (
                              <span className="flex items-center gap-1 font-medium text-success">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            ) : (
                              <span>Provisional</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.min(r.score, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{r.score.toFixed(1)}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 sm:px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-medium tabular-nums text-foreground">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          {formatLatency(r.latency)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 sm:px-6 text-right font-mono text-sm tabular-nums text-foreground">
                        {r.ev.tokens_per_second ? `${formatNumber(r.ev.tokens_per_second)} tps` : "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 sm:px-6 text-right font-mono text-sm tabular-nums">
                        {r.price === 0 ? (
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-sans text-xs font-medium text-foreground">Free</span>
                        ) : (
                          <span className="font-medium text-foreground">
                            {formatCost(r.price)} <span className="font-sans text-xs text-muted-foreground">/ 1M</span>
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col items-start justify-between gap-3 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>95% Wilson confidence intervals computed from each run&apos;s sample size.</span>
        </div>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>Click any accuracy to drill down to per-question results.</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weight slider — native range input styled with tokens (keyboard: arrows, PgUp/PgDn, Home/End)
// ---------------------------------------------------------------------------

const RANGE_CLASS = [
  "h-5 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
  // WebKit / Blink track + thumb
  "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full",
  "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--primary)_var(--fill),var(--track-rest)_var(--fill))]",
  "[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary",
  "[&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-[transform,box-shadow]",
  "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110",
  "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/40",
  // Firefox track + thumb
  "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full",
  "[&::-moz-range-track]:bg-[linear-gradient(to_right,var(--primary)_var(--fill),var(--track-rest)_var(--fill))]",
  "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
  "[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-card [&::-moz-range-thumb]:shadow-sm",
  "focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-ring/40",
].join(" ");

function WeightSlider({
  id,
  label,
  hint,
  value,
  share,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  share: number;
  onChange: (value: number) => void;
}) {
  const style = {
    "--fill": `${value}%`,
    "--track-rest": "color-mix(in oklab, var(--muted-foreground) 25%, transparent)",
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-valuetext={`${value} of 100, ${share}% of the value score`}
        onChange={(e) => onChange(Number(e.target.value))}
        style={style}
        className={RANGE_CLASS}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{hint}</span>
        <span className="shrink-0 font-mono tabular-nums">{share}% of score</span>
      </div>
    </div>
  );
}
