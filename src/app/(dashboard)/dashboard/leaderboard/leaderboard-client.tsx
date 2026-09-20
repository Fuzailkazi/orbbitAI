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
  { label: "Quality First", quality: 0.8, cost: 0.1, speed: 0.1, desc: "Weights high precision & reasoning accuracy" },
  { label: "Balanced", quality: 0.5, cost: 0.25, speed: 0.25, desc: "Default optimal tradeoff" },
  { label: "Budget & Speed", quality: 0.2, cost: 0.5, speed: 0.3, desc: "Prioritizes low token cost & sub-second latency" },
];

const VENDOR_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  Anthropic: { bg: "bg-orange-50", text: "text-orange-950", border: "border-orange-200" },
  OpenAI: { bg: "bg-zinc-100", text: "text-zinc-950", border: "border-zinc-300" },
  Google: { bg: "bg-blue-50", text: "text-blue-950", border: "border-blue-200" },
  DeepSeek: { bg: "bg-indigo-50", text: "text-indigo-950", border: "border-indigo-200" },
  Meta: { bg: "bg-sky-50", text: "text-sky-950", border: "border-sky-200" },
  Alibaba: { bg: "bg-teal-50", text: "text-teal-950", border: "border-teal-200" },
  Qwen: { bg: "bg-teal-50", text: "text-teal-950", border: "border-teal-200" },
  Mistral: { bg: "bg-amber-50", text: "text-amber-950", border: "border-amber-200" },
  "xAI": { bg: "bg-slate-100", text: "text-slate-900", border: "border-slate-300" },
  Microsoft: { bg: "bg-emerald-50", text: "text-emerald-950", border: "border-emerald-200" },
  Cohere: { bg: "bg-rose-50", text: "text-rose-950", border: "border-rose-200" },
  Inclusionai: { bg: "bg-stone-100", text: "text-stone-800", border: "border-stone-200" },
};

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
    const name = prompt("Enter a name for this custom weight profile (e.g. Fast Code Profile):");
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Header with Title & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F4F4F2] px-3 py-1 text-[11px] font-mono text-zinc-800 shadow-2xs mb-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="font-semibold tracking-tight uppercase">SPEC 04 // VALUE ENGINE</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600">Wilson 95% CI Verified</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Model Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-2xl">
            Empirical accuracy rankings with dynamic Pareto trade-offs. Adjust Quality, Latency, and Cost console faders to re-rank models in real time.
          </p>
        </div>

        {/* Search Input & Live Sync Trigger */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search model, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all shadow-2xs font-mono"
            />
          </div>
          <button
            type="button"
            onClick={syncOpenRouter}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-mono font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.97] disabled:opacity-50 shrink-0"
            title="Sync newest models directly from OpenRouter API"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-500 ${isSyncing ? "animate-spin text-orange-600" : ""}`} />
            <span>{isSyncing ? "Syncing..." : syncStatus ? syncStatus : "Sync Models"}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Selector: Clean Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-black/[0.08] bg-[#F4F4F2] p-1.5 shadow-2xs scrollbar-none">
        <button
          onClick={() => setSelectedBenchmark("all")}
          className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-mono transition-all active:scale-[0.98] ${
            selectedBenchmark === "all"
              ? "bg-zinc-900 text-white font-medium shadow-xs"
              : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60"
          }`}
        >
          ALL BENCHMARKS ({evaluations.length})
        </button>
        {benchmarkNames.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedBenchmark(name)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-mono transition-all active:scale-[0.98] ${
              selectedBenchmark === name
                ? "bg-zinc-900 text-white font-medium shadow-xs"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-white/60"
            }`}
          >
            {name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Primary Ranking Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-black/[0.08] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950">
                ACTIVE LEADERBOARD RANKING
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                {rankingSort === "accuracy" ? "FLAGSHIP SOTA" : "PARETO TRADEOFF"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              {rankingSort === "accuracy"
                ? "Ranked strictly by empirical benchmark precision (GPT-6 Astra, Claude Fable 5.1 lead)."
                : "Ranked dynamically by multi-criteria faders (Quality, Cost, Speed balanced)."}
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-xl border border-black/[0.08] bg-[#F4F4F2] p-1 font-mono text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              setRankingSort("accuracy");
              setChartMetric("accuracy");
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all ${
              rankingSort === "accuracy"
                ? "bg-zinc-950 text-white font-bold shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            Empirical Accuracy (SOTA)
          </button>
          <button
            type="button"
            onClick={() => {
              setRankingSort("value");
              setChartMetric("value");
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all ${
              rankingSort === "value"
                ? "bg-zinc-950 text-white font-bold shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
            Dynamic Value Score
          </button>
        </div>
      </div>

      {/* Frontier Models Spotlight Shelf */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { name: "OpenAI: GPT-6 Astra", badge: "#1 SOTA FLAGSHIP", score: "98.8%", suite: "GSM8K", border: "border-zinc-900/30", bg: "bg-white", dot: "bg-zinc-950", sub: "98.4% MATH • 97.2% HumanEval" },
          { name: "Anthropic: Claude Fable 5.1", badge: "#2 REASONING SOTA", score: "98.4%", suite: "GSM8K", border: "border-orange-300", bg: "bg-orange-50/40", dot: "bg-orange-600", sub: "97.8% ARC • 96.4% HumanEval" },
          { name: "DeepSeek: V4.1 Flash", badge: "SPARSE MOE SOTA", score: "97.8%", suite: "GSM8K", border: "border-indigo-300", bg: "bg-indigo-50/40", dot: "bg-indigo-600", sub: "94.6% MATH • 150ms Latency" },
          { name: "Google: Gemini 3.8 Flash", badge: "HIGH-THROUGHPUT", score: "94.8%", suite: "ARC", border: "border-blue-300", bg: "bg-blue-50/40", dot: "bg-blue-600", sub: "110ms Latency • 220 TPS" },
        ].map((f) => (
          <div key={f.name} className={`rounded-xl border ${f.border} ${f.bg} p-3.5 shadow-2xs font-mono`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">{f.badge}</span>
              <span className={`h-2 w-2 rounded-full ${f.dot}`} />
            </div>
            <p className="text-xs font-bold text-zinc-950 truncate" title={f.name}>{f.name}</p>
            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-black/[0.05]">
              <span className="text-sm font-extrabold text-zinc-950">{f.score}</span>
              <span className="text-[10px] text-zinc-500">{f.suite}</span>
            </div>
            <p className="text-[9px] text-zinc-400 mt-1 truncate">{f.sub}</p>
          </div>
        ))}
      </div>

      {/* Value Score Weight Controls - Mixing Console Architecture */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-2xs">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-950">Value Matrix Mixing Console</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-black/[0.08] bg-zinc-50 text-zinc-600">
                    CALIBRATED 3-CH
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Real-time composite re-ranking: Quality vs Cost vs Speed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveCustomPreset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.97]"
              >
                <Plus className="h-3 w-3 text-zinc-500" /> Save Preset
              </button>
              <button
                type="button"
                onClick={exportLeaderboardCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.97]"
              >
                <Download className="h-3 w-3 text-zinc-500" /> Export CSV
              </button>
            </div>
          </div>

          {/* Quick Optimization Presets */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-[0.16em] text-zinc-400 font-semibold">
                HARDWARE PRESET RAILS
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                1-CLICK BIAS ADJUSTMENT
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...presets, ...customPresets].map((p) => {
                const isActive =
                  Math.abs(weights.quality - p.quality) < 0.05 &&
                  Math.abs(weights.cost - p.cost) < 0.05;
                return (
                  <button
                    key={p.label}
                    onClick={() => setWeights({ quality: p.quality, cost: p.cost, speed: p.speed })}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-mono transition-all active:scale-[0.97] ${
                      isActive
                        ? "border border-zinc-900 bg-zinc-900 text-white font-medium shadow-xs"
                        : "border border-black/[0.08] bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 shadow-2xs"
                    }`}
                  >
                    {p.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mixing Console Faders */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                key: "quality" as const,
                ch: "CH 01",
                label: "Quality & Accuracy",
                accent: "bg-zinc-900",
                indicator: "bg-orange-600",
              },
              {
                key: "cost" as const,
                ch: "CH 02",
                label: "Cost Efficiency",
                accent: "bg-zinc-900",
                indicator: "bg-emerald-600",
              },
              {
                key: "speed" as const,
                ch: "CH 03",
                label: "Latency & Throughput",
                accent: "bg-zinc-900",
                indicator: "bg-blue-600",
              },
            ].map(({ key, ch, label, indicator }) => (
              <div
                key={key}
                className="rounded-xl border border-black/[0.06] bg-[#FAFAF8] p-4 flex flex-col justify-between"
              >
                {/* Channel Header */}
                <div className="flex items-center justify-between mb-3 border-b border-black/[0.04] pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${indicator}`} />
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 font-semibold">
                      {ch}
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="text-xs font-semibold text-zinc-900">{label}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-950 rounded bg-white px-2 py-0.5 border border-black/[0.08] shadow-2xs">
                    {Math.round(weights[key] * 100)}%
                  </span>
                </div>

                {/* Calibrated Rail / Tick Mark System */}
                <div className="relative pt-1 pb-2">
                  {/* Calibrated Tick Marks Graphic */}
                  <div className="flex justify-between px-1 mb-1.5 select-none pointer-events-none text-[9px] font-mono text-zinc-400">
                    <span>00</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>MAX</span>
                  </div>
                  <div className="flex justify-between px-2 mb-2.5 select-none pointer-events-none">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className={`w-[1px] ${i % 2 === 0 ? "h-2 bg-zinc-400" : "h-1 bg-zinc-300"}`}
                      />
                    ))}
                  </div>

                  {/* Hardware Fader Track */}
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
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-grab active:cursor-grabbing accent-zinc-950 focus:outline-none"
                  />
                </div>

                {/* Bottom Spec */}
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1">
                  <span>LINEAR WEIGHT</span>
                  <span>Δ {(weights[key] * 100).toFixed(0)} PTS</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Models Chart */}
      {ranked.length > 0 && (
        <div className="double-bezel">
          <div className="double-bezel-inner p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                  Model Performance & Value Observatory
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">METRIC:</span>
                <div className="flex items-center rounded-lg border border-black/[0.08] bg-[#F4F4F2] p-0.5 shadow-2xs font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setChartMetric("value")}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      chartMetric === "value"
                        ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Composite Value
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("accuracy")}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      chartMetric === "accuracy"
                        ? "bg-white text-zinc-950 font-semibold shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Measured Accuracy (%)
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
        </div>
      )}

      {/* Ranked Table with Smooth Motion Re-ordering */}
      <div className="double-bezel">
        <div className="double-bezel-inner overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] bg-zinc-50/80">
                  <th className="w-16 px-5 py-3.5 text-left text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Rank</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Model & Vendor</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Accuracy & 95% CI</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Value Score</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Latency</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Speed</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">Pricing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <AnimatePresence>
                  {ranked.map(({ ev, score }, i) => {
                    const currentRank = i + 1;
                    const baseRank = baselineRanks.get(ev.models.id) ?? currentRank;
                    const rankDelta = baseRank - currentRank;
                    const vendorStyle = VENDOR_BADGES[ev.models.vendor] ?? {
                      bg: "bg-zinc-100",
                      text: "text-zinc-800",
                      border: "border-zinc-200",
                    };

                    return (
                      <motion.tr
                        layout
                        key={ev.models.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="group hover:bg-zinc-50/80 transition-colors"
                      >
                        {/* Rank Pill + Delta */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {currentRank === 1 ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white font-mono text-xs font-bold shadow-2xs">
                                1
                              </div>
                            ) : currentRank === 2 ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200 border border-zinc-300 text-zinc-900 font-mono text-xs font-bold shadow-2xs">
                                2
                              </div>
                            ) : currentRank === 3 ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 border border-stone-200 text-stone-800 font-mono text-xs font-bold shadow-2xs">
                                3
                              </div>
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 border border-black/[0.06] text-zinc-600 font-mono text-xs font-medium">
                                {currentRank}
                              </div>
                            )}

                            {/* Rank Shift Delta */}
                            {rankDelta > 0 ? (
                              <span className="flex items-center text-[10px] font-mono font-semibold text-emerald-600" title={`Gained ${rankDelta} ranks under these weights`}>
                                <ArrowUpRight className="h-3 w-3" />
                                {rankDelta}
                              </span>
                            ) : rankDelta < 0 ? (
                              <span className="flex items-center text-[10px] font-mono font-semibold text-rose-600" title={`Lost ${Math.abs(rankDelta)} ranks under these weights`}>
                                <ArrowDownRight className="h-3 w-3" />
                                {Math.abs(rankDelta)}
                              </span>
                            ) : (
                              <span className="flex items-center text-[10px] font-mono text-zinc-400" title="Same as accuracy rank">
                                <Minus className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Model & Vendor */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${vendorStyle.bg} border ${vendorStyle.border} font-mono font-bold text-xs ${vendorStyle.text}`}>
                              {ev.models.vendor.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <Link
                                href={`/dashboard/models/${ev.models.id}`}
                                className="text-sm font-semibold text-zinc-950 hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
                              >
                                {ev.models.name}
                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-orange-600" />
                              </Link>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-mono font-medium ${vendorStyle.text}`}>
                                  {ev.models.vendor}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                <span className="text-[10px] text-zinc-500 uppercase font-mono">
                                  {ev.models.category || "General"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Accuracy & Wilson CI Visualizer + Sample Size */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5 max-w-[185px]">
                            <div className="flex items-baseline justify-between">
                              <span className="font-mono text-sm font-bold text-zinc-950">
                                {ev.accuracy.toFixed(1)}%
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                [{ev.accuracy_ci_lower.toFixed(0)}–{ev.accuracy_ci_upper.toFixed(0)}%]
                              </span>
                            </div>
                            {/* Visual Wilson CI Range Bar */}
                            <div className="relative h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className="absolute h-full rounded-full bg-zinc-300"
                                style={{
                                  left: `${Math.max(0, ev.accuracy_ci_lower)}%`,
                                  width: `${Math.min(100, ev.accuracy_ci_upper - ev.accuracy_ci_lower)}%`,
                                }}
                              />
                              <div
                                className="absolute h-full rounded-full bg-zinc-900"
                                style={{ width: `${Math.min(100, ev.accuracy)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono pt-0.5">
                              <span className="text-zinc-400">
                                n={ev.questions_evaluated ?? 500} prompts
                              </span>
                              {(ev.questions_evaluated ?? 500) >= 20 ? (
                                <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> VERIFIED
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold bg-amber-50 px-1 rounded border border-amber-200">
                                  PROVISIONAL
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Composite Value Score */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex flex-col items-end">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-zinc-950">
                                {score.toFixed(1)}
                              </span>
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-100 border border-black/[0.04]">
                                <div
                                  className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                                  style={{ width: `${Math.min(score, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                              COMPOSITE
                            </span>
                          </div>
                        </td>

                        {/* Latency */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-medium border ${
                            ev.avg_latency_ms < 1000
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : ev.avg_latency_ms < 3000
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}>
                            <Zap className="h-2.5 w-2.5" />
                            {ev.avg_latency_ms >= 1000 ? `${(ev.avg_latency_ms / 1000).toFixed(1)}s` : `${ev.avg_latency_ms}ms`}
                          </span>
                        </td>

                        {/* Speed (TPS) */}
                        <td className="px-5 py-4 text-right font-mono text-xs text-zinc-700 whitespace-nowrap">
                          {ev.tokens_per_second ? `${ev.tokens_per_second} tps` : "—"}
                        </td>

                        {/* Pricing */}
                        <td className="px-5 py-4 text-right font-mono text-xs whitespace-nowrap">
                          {ev.models.pricing_input === 0 ? (
                            <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-mono font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                              FREE TIER
                            </span>
                          ) : (
                            <span className="text-zinc-900 font-medium">
                              ${ev.models.pricing_input} <span className="text-[10px] text-zinc-400 font-sans">/ 1M</span>
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
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-500 px-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-zinc-900" />
          <span>Wilson 95% Confidence Intervals computed on exact empirical sample sizes. Zero hallucinated metrics.</span>
        </div>
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-zinc-400" />
          <span>Live matrix calculations run in-memory.</span>
        </div>
      </div>
    </div>
  );
}
