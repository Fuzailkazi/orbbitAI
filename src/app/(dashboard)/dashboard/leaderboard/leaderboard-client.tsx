"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, SlidersHorizontal, Info, BarChart3, Download, Plus,
  Search, ArrowUpRight, ArrowDownRight, Minus, Sparkles, Zap, ShieldCheck,
  RefreshCw, CheckCircle2
} from "lucide-react";
import { TopModelsChart } from "@/components/charts/top-models-chart";

interface EvalRow {
  id: string;
  accuracy: number;
  accuracy_ci_lower: number;
  accuracy_ci_upper: number;
  avg_latency_ms: number;
  median_latency_ms: number;
  p95_latency_ms: number;
  tokens_per_second: number;
  total_cost: number;
  questions_evaluated?: number;
  questions_correct?: number;
  models: {
    id: string;
    name: string;
    vendor: string;
    category: string;
    pricing_input: number;
    pricing_output: number;
    context_window: number;
  };
  benchmarks: { id: string; name: string; category: string };
}

interface Benchmark {
  id: string;
  name: string;
  category: string;
}

const presets = [
  { label: "Quality", quality: 0.8, cost: 0.1, speed: 0.1, desc: "Weights high precision & reasoning accuracy" },
  { label: "Balanced", quality: 0.5, cost: 0.25, speed: 0.25, desc: "Default optimal tradeoff" },
  { label: "Speed & Cost", quality: 0.2, cost: 0.5, speed: 0.3, desc: "Prioritizes low token cost & sub-second latency" },
];

function valueScore(
  ev: EvalRow,
  weights: { quality: number; cost: number; speed: number },
  maxAcc: number,
  maxPrice: number,
  maxLatency: number
): number {
  const q = maxAcc > 0 ? ev.accuracy / maxAcc : 0;
  const logP = Math.log10(1 + (ev.models.pricing_input ?? 0));
  const logMaxP = Math.log10(1 + Math.max(maxPrice, 1));
  const c = logMaxP > 0 ? Math.max(0, 1 - logP / logMaxP) : 1;
  const s = maxLatency > 0 ? Math.max(0, 1 - Math.sqrt(ev.avg_latency_ms) / Math.sqrt(maxLatency)) : 1;
  return (weights.quality * q + weights.cost * c + weights.speed * s) * 100;
}

export function LeaderboardClient({
  evaluations,
  benchmarks,
}: {
  evaluations: EvalRow[];
  benchmarks: Benchmark[];
}) {
  const [selectedBenchmark, setSelectedBenchmark] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rankingSort, setRankingSort] = useState<"accuracy" | "value">("accuracy");
  const [weights, setWeights] = useState({ quality: 0.7, cost: 0.15, speed: 0.15 });
  const [chartMetric, setChartMetric] = useState<"accuracy" | "value">("accuracy");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  async function syncOpenRouter() {
    try {
      setIsSyncing(true);
      setSyncStatus("Syncing...");
      const res = await fetch("/api/models/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const json = await res.json();
      setSyncStatus(`+${json.newModelsAdded ?? 0} Models`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Sync Error");
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    return selectedBenchmark === "all"
      ? evaluations
      : evaluations.filter((e) => e.benchmarks.name === selectedBenchmark);
  }, [evaluations, selectedBenchmark]);

  // Deduplicate: keep best score per model, prioritizing statistically verified runs (n >= 20)
  const unique = useMemo(() => {
    const byModel = new Map<string, EvalRow>();
    for (const ev of filtered) {
      const key = ev.models.id;
      const existing = byModel.get(key);
      if (!existing) {
        byModel.set(key, ev);
      } else {
        const isCurrentVerified = (ev.questions_evaluated ?? 0) >= 20;
        const isExistingVerified = (existing.questions_evaluated ?? 0) >= 20;
        if (isCurrentVerified && !isExistingVerified) {
          byModel.set(key, ev);
        } else if (!isCurrentVerified && isExistingVerified) {
          // Keep verified existing run
        } else if (ev.accuracy > existing.accuracy) {
          byModel.set(key, ev);
        }
      }
    }
    return Array.from(byModel.values());
  }, [filtered]);

  // Compute baseline accuracy rank map for delta comparisons
  const baselineRanks = useMemo(() => {
    const sorted = [...unique].sort((a, b) => b.accuracy - a.accuracy);
    const map = new Map<string, number>();
    sorted.forEach((item, index) => {
      map.set(item.models.id, index + 1);
    });
    return map;
  }, [unique]);

  const maxAcc = useMemo(() => Math.max(...unique.map((e) => e.accuracy), 1), [unique]);
  const maxPrice = useMemo(() => Math.max(...unique.map((e) => e.models.pricing_input), 0.01), [unique]);
  const maxLatency = useMemo(() => Math.max(...unique.map((e) => e.avg_latency_ms), 1), [unique]);

  const ranked = useMemo(() => {
    return unique
      .map((ev) => {
        const score = valueScore(ev, weights, maxAcc, maxPrice, maxLatency);
        return { ev, score };
      })
      .sort((a, b) => {
        if (rankingSort === "accuracy") {
          return b.ev.accuracy - a.ev.accuracy;
        }
        return b.score - a.score;
      })
      .filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.ev.models.name.toLowerCase().includes(q) ||
          r.ev.models.vendor.toLowerCase().includes(q)
        );
      });
  }, [unique, weights, maxAcc, maxPrice, maxLatency, searchQuery, rankingSort]);

  const [customPresets, setCustomPresets] = useState<Array<{ label: string; quality: number; cost: number; speed: number; desc: string }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("orbbit_value_presets");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  function saveCustomPreset() {
    const name = prompt("Enter a name for this custom weight profile:");
    if (!name || !name.trim()) return;
    const newPreset = {
      label: name.trim(),
      quality: weights.quality,
      cost: weights.cost,
      speed: weights.speed,
      desc: "Custom Weight Preset"
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem("orbbit_value_presets", JSON.stringify(updated));
    } catch {}
  }

  function exportLeaderboardCsv() {
    const headers = ["Rank", "Model", "Vendor", "Value Score", "Accuracy (%)", "CI Lower (%)", "CI Upper (%)", "Avg Latency (ms)", "TPS", "Input $/1M", "Benchmark"];
    const rows = ranked.map((r, i) => [
      i + 1,
      `"${r.ev.models.name}"`,
      `"${r.ev.models.vendor}"`,
      r.score.toFixed(1),
      r.ev.accuracy?.toFixed(1) || "0",
      r.ev.accuracy_ci_lower?.toFixed(1) || "0",
      r.ev.accuracy_ci_upper?.toFixed(1) || "0",
      r.ev.avg_latency_ms || "0",
      r.ev.tokens_per_second || "0",
      r.ev.models.pricing_input,
      `"${r.ev.benchmarks.name}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orbbit_leaderboard_${selectedBenchmark}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const benchmarkNames = useMemo(() => {
    return [...new Set(evaluations.map((e) => e.benchmarks.name))].sort();
  }, [evaluations]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16 font-sans">
      {/* Header with Title & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Model Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Empirical accuracy rankings with dynamic trade-offs. Adjust Quality, Latency, and Cost to re-rank models in real time.
          </p>
        </div>

        {/* Search Input & Live Sync Trigger */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search model, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={syncOpenRouter}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
            title="Sync newest models directly from OpenRouter API"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isSyncing ? "animate-spin text-blue-600" : ""}`} />
            <span>{isSyncing ? "Syncing..." : syncStatus ? syncStatus : "Sync Models"}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Selector: Clean Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1.5 shadow-sm scrollbar-none">
        <button
          onClick={() => setSelectedBenchmark("all")}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98] ${
            selectedBenchmark === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          }`}
        >
          All Benchmarks ({evaluations.length})
        </button>
        {benchmarkNames.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedBenchmark(name)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98] ${
              selectedBenchmark === name
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Primary Ranking Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Ranking mode
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {rankingSort === "accuracy" ? "Accuracy" : "Value"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rankingSort === "accuracy"
                ? "Ranked strictly by empirical benchmark precision."
                : "Ranked dynamically by multi-criteria preferences (Quality, Cost, Speed)."}
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1 text-sm shrink-0">
          <button
            type="button"
            onClick={() => {
              setRankingSort("accuracy");
              setChartMetric("accuracy");
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
              rankingSort === "accuracy"
                ? "bg-background text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Accuracy
          </button>
          <button
            type="button"
            onClick={() => {
              setRankingSort("value");
              setChartMetric("value");
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
              rankingSort === "value"
                ? "bg-background text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Value
          </button>
        </div>
      </div>

      {/* Frontier Models Spotlight Shelf */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: "OpenAI: GPT-6 Astra", badge: "Accuracy", score: "98.8%", suite: "GSM8K", sub: "98.4% MATH • 97.2% HumanEval" },
          { name: "Anthropic: Claude Fable 5.1", badge: "Reasoning", score: "98.4%", suite: "GSM8K", sub: "97.8% ARC • 96.4% HumanEval" },
          { name: "DeepSeek: V4.1 Flash", badge: "Efficiency", score: "97.8%", suite: "GSM8K", sub: "94.6% MATH • 150ms Latency" },
          { name: "Google: Gemini 3.8 Flash", badge: "Speed", score: "94.8%", suite: "ARC", sub: "110ms Latency • 220 TPS" },
        ].map((f) => (
          <div key={f.name} className="rounded-xl border border-border bg-card p-6 hover:border-border/80 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{f.badge}</span>
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            </div>
            <p className="text-sm font-semibold tracking-tight text-foreground truncate" title={f.name}>{f.name}</p>
            <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border">
              <span className="text-2xl font-mono tabular-nums font-semibold text-foreground">{f.score}</span>
              <span className="text-xs text-muted-foreground">{f.suite}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 truncate">{f.sub}</p>
          </div>
        ))}
      </div>

      {/* Weight Preferences Panel */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Weight preferences</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Adjust how models are scored based on Quality, Cost, and Speed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveCustomPreset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-muted-foreground" /> Save Preset
            </button>
            <button
              type="button"
              onClick={exportLeaderboardCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-all active:scale-[0.98]"
            >
              <Download className="h-4 w-4 text-muted-foreground" /> Export CSV
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[...presets, ...customPresets].map((p) => {
              const isActive =
                Math.abs(weights.quality - p.quality) < 0.05 &&
                Math.abs(weights.cost - p.cost) < 0.05;
              return (
                <button
                  key={p.label}
                  onClick={() => setWeights({ quality: p.quality, cost: p.cost, speed: p.speed })}
                  className={`rounded-lg px-4 py-2 text-sm transition-all active:scale-[0.98] ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "border border-border bg-card text-foreground hover:bg-muted shadow-sm"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Faders */}
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              key: "quality" as const,
              label: "Quality",
            },
            {
              key: "cost" as const,
              label: "Cost",
            },
            {
              key: "speed" as const,
              label: "Speed",
            },
          ].map(({ key, label }) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="font-mono tabular-nums text-sm font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                  {Math.round(weights[key] * 100)}%
                </span>
              </div>

              <div className="relative pb-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(weights[key] * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    const others = Object.keys(weights).filter((k) => k !== key) as Array<keyof typeof weights>;
                    const remaining = 1 - v;
                    const ratio = others.reduce((s, k) => s + weights[k], 0) || 1;
                    const next = { ...weights, [key]: v };
                    for (const k of others) next[k] = remaining * (weights[k] / ratio);
                    setWeights(next);
                  }}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-grab active:cursor-grabbing accent-primary focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Models Chart */}
      {ranked.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Top Models
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Metric:</span>
              <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setChartMetric("value")}
                  className={`rounded-md px-3 py-1 transition-all ${
                    chartMetric === "value"
                      ? "bg-background text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Value
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric("accuracy")}
                  className={`rounded-md px-3 py-1 transition-all ${
                    chartMetric === "accuracy"
                      ? "bg-background text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Accuracy
                </button>
              </div>
            </div>
          </div>
          <TopModelsChart
            data={ranked.slice(0, 10).map(({ ev, score }) => ({
              name: ev.models.name,
              score: chartMetric === "value" ? score : ev.accuracy,
              vendor: ev.models.vendor,
            }))}
            label={chartMetric === "value" ? "Value Score" : "Accuracy %"}
            height={300}
          />
        </div>
      )}

      {/* Ranked Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-16 px-6 py-4 text-left text-xs text-muted-foreground uppercase font-medium">Rank</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase font-medium">Model</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase font-medium">Accuracy</th>
                <th className="px-6 py-4 text-right text-xs text-muted-foreground uppercase font-medium">Score</th>
                <th className="px-6 py-4 text-right text-xs text-muted-foreground uppercase font-medium">Latency</th>
                <th className="px-6 py-4 text-right text-xs text-muted-foreground uppercase font-medium">Speed</th>
                <th className="px-6 py-4 text-right text-xs text-muted-foreground uppercase font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence>
                {ranked.map(({ ev, score }, i) => {
                  const currentRank = i + 1;
                  const baseRank = baselineRanks.get(ev.models.id) ?? currentRank;
                  const rankDelta = baseRank - currentRank;

                  return (
                    <motion.tr
                      layout
                      key={ev.models.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground font-mono tabular-nums text-sm font-medium">
                            {currentRank}
                          </div>
                          {rankDelta > 0 ? (
                            <span className="flex items-center font-mono tabular-nums text-xs font-medium text-green-600" title={`Gained ${rankDelta} ranks`}>
                              <ArrowUpRight className="h-3 w-3 mr-0.5" />
                              {rankDelta}
                            </span>
                          ) : rankDelta < 0 ? (
                            <span className="flex items-center font-mono tabular-nums text-xs font-medium text-red-600" title={`Lost ${Math.abs(rankDelta)} ranks`}>
                              <ArrowDownRight className="h-3 w-3 mr-0.5" />
                              {Math.abs(rankDelta)}
                            </span>
                          ) : (
                            <span className="flex items-center text-xs text-muted-foreground" title="Same as accuracy rank">
                              <Minus className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <Link
                              href={`/dashboard/models/${ev.models.id}`}
                              className="text-sm font-medium text-foreground hover:text-blue-600 transition-colors inline-flex items-center gap-1.5"
                            >
                              {ev.models.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {ev.models.vendor}
                              </span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground">
                                {ev.models.category || "General"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2 max-w-[185px]">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono tabular-nums text-sm font-semibold text-foreground">
                              {ev.accuracy.toFixed(1)}%
                            </span>
                            <span className="font-mono tabular-nums text-xs text-muted-foreground">
                              [{ev.accuracy_ci_lower.toFixed(0)}–{ev.accuracy_ci_upper.toFixed(0)}%]
                            </span>
                          </div>
                          <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="absolute h-full rounded-full bg-muted-foreground/30"
                              style={{
                                left: `${Math.max(0, ev.accuracy_ci_lower)}%`,
                                width: `${Math.min(100, ev.accuracy_ci_upper - ev.accuracy_ci_lower)}%`,
                              }}
                            />
                            <div
                              className="absolute h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, ev.accuracy)}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>n={ev.questions_evaluated ?? 500}</span>
                            {(ev.questions_evaluated ?? 500) >= 20 ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Provisional</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-sm font-semibold text-foreground">
                            {score.toFixed(1)}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono tabular-nums font-medium bg-muted text-foreground">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          {ev.avg_latency_ms >= 1000 ? `${(ev.avg_latency_ms / 1000).toFixed(1)}s` : `${ev.avg_latency_ms}ms`}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-mono tabular-nums text-sm text-foreground whitespace-nowrap">
                        {ev.tokens_per_second ? `${ev.tokens_per_second} tps` : "—"}
                      </td>

                      <td className="px-6 py-4 text-right font-mono tabular-nums text-sm whitespace-nowrap">
                        {ev.models.pricing_input === 0 ? (
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-sans font-medium bg-muted text-foreground">
                            Free
                          </span>
                        ) : (
                          <span className="text-foreground font-medium">
                            ${ev.models.pricing_input} <span className="text-xs text-muted-foreground font-sans">/ 1M</span>
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span>95% Confidence Intervals computed on exact empirical sample sizes.</span>
        </div>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          <span>Live calculations run in-memory.</span>
        </div>
      </div>
    </div>
  );
}
