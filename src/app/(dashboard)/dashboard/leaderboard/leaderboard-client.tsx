"use client";

import { useState } from "react";
import Link from "next/link";
import type { Model, ModelCategory } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, SlidersHorizontal, Info } from "lucide-react";

interface Benchmark {
  id: string;
  name: string;
  category: string;
}

const categoryTabs: { value: ModelCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "reasoning", label: "Reasoning" },
  { value: "code", label: "Code" },
  { value: "vision", label: "Vision" },
  { value: "moe", label: "MoE" },
];

const presets = [
  { label: "Quality First", quality: 0.8, cost: 0.1, speed: 0.1 },
  { label: "Balanced", quality: 0.5, cost: 0.25, speed: 0.25 },
  { label: "Budget Pick", quality: 0.2, cost: 0.6, speed: 0.2 },
];

function computeValueScore(
  model: Model,
  weights: { quality: number; cost: number; speed: number },
  allModels: Model[]
): number {
  const maxCtx = Math.max(...allModels.map((m) => m.context_window), 1);
  const maxPrice = Math.max(...allModels.map((m) => m.pricing_input), 0.01);

  const qualityNorm = model.context_window / maxCtx;
  const costNorm = 1 - model.pricing_input / maxPrice;
  const speedNorm = model.pricing_input === 0 ? 1 : costNorm;

  return (
    weights.quality * qualityNorm +
    weights.cost * costNorm +
    weights.speed * speedNorm
  ) * 100;
}

export function LeaderboardClient({
  models,
  benchmarks,
}: {
  models: Model[];
  benchmarks: Benchmark[];
}) {
  const [category, setCategory] = useState<ModelCategory | "all">("all");
  const [weights, setWeights] = useState({ quality: 0.5, cost: 0.25, speed: 0.25 });

  const filtered = category === "all"
    ? models
    : models.filter((m) => m.category === category);

  const ranked = filtered
    .map((m) => ({
      model: m,
      score: computeValueScore(m, weights, models),
    }))
    .sort((a, b) => b.score - a.score);

  function setPreset(p: typeof presets[0]) {
    setWeights({ quality: p.quality, cost: p.cost, speed: p.speed });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rank {models.length} models with adjustable weights. Your definition of &quot;best&quot;.
        </p>
      </div>

      {/* Value Score Controls */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-sm font-semibold text-slate-900">Value Score Weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Presets */}
          <div className="flex gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p)}
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

          {/* Sliders */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Quality</span>
                <span className="font-mono text-indigo-600">{Math.round(weights.quality * 100)}%</span>
              </label>
              <input
                type="range"
                min={0} max={100} value={weights.quality * 100}
                onChange={(e) => {
                  const q = Number(e.target.value) / 100;
                  const remaining = 1 - q;
                  const ratio = weights.cost + weights.speed || 1;
                  setWeights({ quality: q, cost: remaining * (weights.cost / ratio), speed: remaining * (weights.speed / ratio) });
                }}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Cost</span>
                <span className="font-mono text-emerald-600">{Math.round(weights.cost * 100)}%</span>
              </label>
              <input
                type="range"
                min={0} max={100} value={weights.cost * 100}
                onChange={(e) => {
                  const c = Number(e.target.value) / 100;
                  const remaining = 1 - c;
                  const ratio = weights.quality + weights.speed || 1;
                  setWeights({ quality: remaining * (weights.quality / ratio), cost: c, speed: remaining * (weights.speed / ratio) });
                }}
                className="w-full accent-emerald-600"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Speed</span>
                <span className="font-mono text-amber-600">{Math.round(weights.speed * 100)}%</span>
              </label>
              <input
                type="range"
                min={0} max={100} value={weights.speed * 100}
                onChange={(e) => {
                  const s = Number(e.target.value) / 100;
                  const remaining = 1 - s;
                  const ratio = weights.quality + weights.cost || 1;
                  setWeights({ quality: remaining * (weights.quality / ratio), cost: remaining * (weights.cost / ratio), speed: s });
                }}
                className="w-full accent-amber-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {categoryTabs.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              category === c.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto px-3 text-xs text-slate-400">{ranked.length} models</span>
      </div>

      {/* Ranked Table */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-12 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Model</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vendor</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Value Score</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Context</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Input $/1M</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Output $/1M</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ranked.slice(0, 50).map(({ model, score }, i) => (
                  <tr key={model.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className={`text-sm font-bold ${i < 3 ? "text-indigo-600" : "text-slate-400"}`}>
                        {i === 0 && <Trophy className="inline h-3.5 w-3.5 mr-0.5 text-amber-500" />}
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/models/${model.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        {model.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{model.vendor}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {score.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.context_window >= 1000000
                        ? `${(model.context_window / 1000000).toFixed(1)}M`
                        : `${(model.context_window / 1000).toFixed(0)}K`}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.pricing_input === 0 ? "Free" : `$${model.pricing_input}`}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.pricing_output === 0 ? "Free" : `$${model.pricing_output}`}
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
        <span>Value scores are computed from context window and pricing. Accuracy-based ranking available after evaluations (Phase 4).</span>
      </div>
    </div>
  );
}
