"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, SlidersHorizontal, Info } from "lucide-react";

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
  { label: "Quality First", quality: 0.8, cost: 0.1, speed: 0.1 },
  { label: "Balanced", quality: 0.5, cost: 0.25, speed: 0.25 },
  { label: "Budget Pick", quality: 0.2, cost: 0.6, speed: 0.2 },
];

function valueScore(
  ev: EvalRow,
  weights: { quality: number; cost: number; speed: number },
  maxAcc: number,
  maxPrice: number,
  maxLatency: number
): number {
  const q = maxAcc > 0 ? ev.accuracy / maxAcc : 0;
  const c = maxPrice > 0 ? 1 - ev.models.pricing_input / maxPrice : 1;
  const s = maxLatency > 0 ? 1 - ev.avg_latency_ms / maxLatency : 1;
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
  const [weights, setWeights] = useState({ quality: 0.5, cost: 0.25, speed: 0.25 });

  const filtered = selectedBenchmark === "all"
    ? evaluations
    : evaluations.filter((e) => e.benchmarks.name === selectedBenchmark);

  // Deduplicate: keep best score per model for "all" view
  const byModel = new Map<string, EvalRow>();
  for (const ev of filtered) {
    const key = ev.models.id;
    const existing = byModel.get(key);
    if (!existing || ev.accuracy > existing.accuracy) {
      byModel.set(key, ev);
    }
  }
  const unique = Array.from(byModel.values());

  const maxAcc = Math.max(...unique.map((e) => e.accuracy), 1);
  const maxPrice = Math.max(...unique.map((e) => e.models.pricing_input), 0.01);
  const maxLatency = Math.max(...unique.map((e) => e.avg_latency_ms), 1);

  const ranked = unique
    .map((ev) => ({
      ev,
      score: valueScore(ev, weights, maxAcc, maxPrice, maxLatency),
    }))
    .sort((a, b) => b.score - a.score);

  const benchmarkNames = [...new Set(evaluations.map((e) => e.benchmarks.name))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {evaluations.length} evaluations across {benchmarkNames.length} benchmarks. Ranked by your weights.
        </p>
      </div>

      {/* Benchmark selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        <button
          onClick={() => setSelectedBenchmark("all")}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedBenchmark === "all" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All Benchmarks
        </button>
        {benchmarkNames.map((name) => (
          <button
            key={name}
            onClick={() => setSelectedBenchmark(name)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedBenchmark === name ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Value Score Controls */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-sm font-semibold text-slate-900">Value Score Weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setWeights({ quality: p.quality, cost: p.cost, speed: p.speed })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  weights.quality === p.quality && weights.cost === p.cost
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { key: "quality" as const, label: "Quality", color: "accent-indigo-600", textColor: "text-indigo-600" },
              { key: "cost" as const, label: "Cost", color: "accent-emerald-600", textColor: "text-emerald-600" },
              { key: "speed" as const, label: "Speed", color: "accent-amber-600", textColor: "text-amber-600" },
            ].map(({ key, label, color, textColor }) => (
              <div key={key}>
                <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>{label}</span>
                  <span className={`font-mono ${textColor}`}>{Math.round(weights[key] * 100)}%</span>
                </label>
                <input
                  type="range" min={0} max={100} value={weights[key] * 100}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    const others = Object.keys(weights).filter((k) => k !== key) as Array<keyof typeof weights>;
                    const remaining = 1 - v;
                    const ratio = others.reduce((s, k) => s + weights[k], 0) || 1;
                    const next = { ...weights, [key]: v };
                    for (const k of others) next[k] = remaining * (weights[k] / ratio);
                    setWeights(next);
                  }}
                  className={`w-full ${color}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ranked Table */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-12 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Model</th>
                  {selectedBenchmark !== "all" && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accuracy (CI)</th>
                  )}
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Value Score</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Latency</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">TPS</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Input $/1M</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ranked.map(({ ev, score }, i) => (
                  <tr key={ev.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className={`text-sm font-bold ${i < 3 ? "text-indigo-600" : "text-slate-400"}`}>
                        {i === 0 && <Trophy className="inline h-3.5 w-3.5 mr-0.5 text-amber-500" />}
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/models/${ev.models.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors">
                        {ev.models.name}
                      </Link>
                      <p className="text-[10px] text-slate-400">{ev.models.vendor}</p>
                    </td>
                    {selectedBenchmark !== "all" && (
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono text-sm font-semibold text-slate-900">{ev.accuracy.toFixed(1)}%</span>
                        <span className="ml-1 text-[10px] text-slate-400">
                          ({ev.accuracy_ci_lower.toFixed(1)}–{ev.accuracy_ci_upper.toFixed(1)})
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(score, 100)}%` }} />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-700">{score.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {ev.avg_latency_ms >= 1000 ? `${(ev.avg_latency_ms / 1000).toFixed(1)}s` : `${ev.avg_latency_ms}ms`}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">{ev.tokens_per_second}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {ev.models.pricing_input === 0 ? "Free" : `$${ev.models.pricing_input}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Info className="h-3 w-3" />
        <span>Accuracy data sourced from public leaderboards. CI = 95% Wilson confidence interval.</span>
      </div>
    </div>
  );
}
