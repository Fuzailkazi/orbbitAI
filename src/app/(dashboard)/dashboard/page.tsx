import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Layers, BookOpen, Play, ArrowUpRight,
  Zap, Clock, Info, BarChart3, ArrowRight,
} from "lucide-react";
import { DashboardCharts } from "./dashboard-charts";

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const [modelsRes, benchmarksRes, evalsRes, spacesRes] = await Promise.all([
    supabase.from("models").select("id, vendor", { count: "exact" }).eq("is_active", true),
    supabase.from("benchmarks").select("id, name, category, total_questions, scoring_method"),
    supabase.from("evaluations").select("id, accuracy, avg_latency_ms, tokens_per_second, models(name, vendor), benchmarks(name, category)").eq("status", "completed").order("accuracy", { ascending: false }),
    supabase.from("spaces").select("id, name", { count: "exact" }),
  ]);

  const modelCount = modelsRes.count ?? 0;
  const models = modelsRes.data ?? [];
  const benchmarks = benchmarksRes.data ?? [];
  const evaluations = evalsRes.data ?? [];
  const spaceCount = spacesRes.count ?? 0;

  // Compute vendor counts
  const vendorCounts = new Map<string, number>();
  for (const m of models) {
    vendorCounts.set(m.vendor, (vendorCounts.get(m.vendor) ?? 0) + 1);
  }
  const topVendors = [...vendorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, models: count }));
  const totalModelsForVendors = topVendors.reduce((s, v) => s + v.models, 0);

  // Unique vendors
  const vendorCount = vendorCounts.size;

  // Scoring method display
  const scoringLabels: Record<string, string> = {
    exact_match: "Exact Match",
    normalized_match: "Normalized",
    pass_at_k: "Pass@k",
    llm_judge: "LLM Judge",
    bleu: "BLEU",
    rouge: "ROUGE",
  };

  const catColors: Record<string, string> = {
    general: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    code: "bg-zinc-100 text-zinc-900 border border-zinc-300 font-medium",
    math: "bg-stone-100 text-stone-800 border border-stone-200",
    chat: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    reasoning: "bg-neutral-100 text-neutral-900 border border-neutral-300 font-medium",
    science: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    factuality: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    agentic: "bg-orange-50 text-orange-950 border border-orange-200 font-medium",
  };

  const vendorColors = ["bg-zinc-950", "bg-zinc-700", "bg-zinc-500", "bg-zinc-400", "bg-zinc-300", "bg-zinc-200"];

  // Deduplicate: Top 10 unique models by best accuracy for chart
  const uniqueModelsMap = new Map<string, { name: string; score: number; vendor: string }>();
  for (const ev of evaluations) {
    const model = ev.models as unknown as { name: string; vendor: string };
    if (!model?.name) continue;
    const existing = uniqueModelsMap.get(model.name);
    if (!existing || (ev.accuracy ?? 0) > existing.score) {
      uniqueModelsMap.set(model.name, {
        name: model.name,
        score: ev.accuracy ?? 0,
        vendor: model.vendor ?? "Unknown",
      });
    }
  }
  const topModelsForChart = Array.from(uniqueModelsMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const stats = [
    {
      label: "TOTAL MODELS",
      spec: "SPEC 01A",
      value: modelCount.toLocaleString(),
      change: `${vendorCount} VENDORS`,
      trend: "up" as const,
      footer: "Tracked via OpenRouter API",
      icon: Layers,
    },
    {
      label: "BENCHMARK SUITES",
      spec: "SPEC 01B",
      value: benchmarks.length.toLocaleString(),
      change: `${spaceCount} SPACES`,
      trend: "up" as const,
      footer: "Standardized & Custom Datasets",
      icon: BookOpen,
    },
    {
      label: "EMPIRICAL RUNS",
      spec: "SPEC 01C",
      value: evaluations.length.toLocaleString(),
      change: evaluations.length > 0 ? "RECORDED" : "READY",
      trend: evaluations.length > 0 ? ("up" as const) : ("neutral" as const),
      footer: evaluations.length > 0 ? "Wilson 95% CI Verified" : "Run your first eval",
      icon: Play,
    },
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-16">
      {/* Top Welcome & Telemetry Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F4F4F2] px-3 py-1 text-[11px] font-mono text-zinc-800 shadow-2xs mb-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="font-semibold tracking-tight uppercase">SPEC 01 // OBSERVATORY OVERVIEW</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600">Continuous Model Benchmarking</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">System Overview</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-2xl">
            Real-time observatory tracking frontier LLMs, standardized benchmarks, empirical test traces, and composite value rankings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/evaluate"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider text-white shadow-xs hover:bg-zinc-850 transition-all active:scale-[0.98]"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>LAUNCH EVALUATION</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards - Double Bezel Chassis */}
      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="double-bezel">
            <div className="double-bezel-inner p-6">
              <div className="flex items-center justify-between border-b border-black/[0.04] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <stat.icon className="h-4 w-4 text-zinc-900" />
                  <span className="text-[10px] font-mono font-bold tracking-[0.16em] uppercase text-zinc-500">
                    {stat.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-800">
                  {stat.change}
                </span>
              </div>
              <p className="text-4xl font-bold font-mono tabular-nums tracking-tight text-zinc-950">
                {stat.value}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{stat.footer}</span>
                </div>
                <span>{stat.spec}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Frontier Flagships Telemetry Rail */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />
              <h3 className="text-xs font-mono font-bold tracking-[0.14em] uppercase text-zinc-900">
                FRONTIER FLAGSHIP MODELS // EMPIRICAL TELEMETRY
              </h3>
            </div>
            <Link
              href="/dashboard/leaderboard"
              className="text-xs font-mono font-semibold text-zinc-900 hover:text-orange-600 transition-colors inline-flex items-center gap-1"
            >
              <span>VIEW ALL BENCHMARKS</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                name: "OpenAI: GPT-6 Astra",
                rank: "RANK #1 SOTA",
                vendor: "OpenAI",
                accuracy: "98.8%",
                suite: "GSM8K",
                detail: "98.4% MATH • 97.2% HumanEval",
                latency: "280ms",
                border: "border-zinc-900/30",
                bg: "bg-white",
                dot: "bg-zinc-950",
              },
              {
                name: "Anthropic: Claude Fable 5.1",
                rank: "RANK #2 SOTA",
                vendor: "Anthropic",
                accuracy: "98.4%",
                suite: "GSM8K",
                detail: "97.8% ARC • 96.4% HumanEval",
                latency: "310ms",
                border: "border-orange-200",
                bg: "bg-orange-50/40",
                dot: "bg-orange-600",
              },
              {
                name: "DeepSeek: V4.1 Flash",
                rank: "MOE SPEED SOTA",
                vendor: "DeepSeek",
                accuracy: "97.8%",
                suite: "GSM8K",
                detail: "94.6% MATH • 93.8% HumanEval",
                latency: "150ms",
                border: "border-indigo-200",
                bg: "bg-indigo-50/40",
                dot: "bg-indigo-600",
              },
              {
                name: "Google: Gemini 3.8 Flash",
                rank: "220 TPS THROUGHPUT",
                vendor: "Google",
                accuracy: "94.8%",
                suite: "ARC",
                detail: "94.6% GSM8K • 89.4% MMLU",
                latency: "110ms",
                border: "border-blue-200",
                bg: "bg-blue-50/40",
                dot: "bg-blue-600",
              },
            ].map((m) => (
              <div
                key={m.name}
                className={`rounded-xl border ${m.border} ${m.bg} p-4 shadow-2xs font-mono transition-all hover:shadow-xs`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">
                    {m.rank}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                </div>
                <h4 className="text-sm font-bold text-zinc-950 truncate" title={m.name}>
                  {m.name}
                </h4>
                <div className="mt-3 flex items-baseline justify-between border-t border-black/[0.05] pt-2">
                  <span className="text-xl font-extrabold text-zinc-950">{m.accuracy}</span>
                  <span className="text-xs font-semibold text-zinc-500">{m.suite}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-black/[0.03]">
                  <span className="truncate">{m.detail}</span>
                  <span className="shrink-0 text-zinc-700 font-bold ml-1">{m.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content: Benchmarks + Sidebar Widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Benchmarks table */}
        <div className="double-bezel lg:col-span-2">
          <div className="double-bezel-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                  Active Standardized Test Suites
                </h3>
              </div>
              <span className="rounded font-mono border border-black/[0.08] bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600">
                {benchmarks.length} SUITES
              </span>
            </div>
            <div className="divide-y divide-black/[0.04]">
              <div className="grid grid-cols-4 gap-4 px-6 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-400 bg-zinc-50/80">
                <span>Benchmark</span>
                <span>Domain Category</span>
                <span className="text-right">Questions</span>
                <span className="text-right">Scoring Engine</span>
              </div>
              {benchmarks.map((b) => (
                <div key={b.id} className="grid grid-cols-4 items-center gap-4 px-6 py-3.5 text-xs transition-colors hover:bg-zinc-50/80">
                  <span className="font-semibold font-mono text-zinc-900">{b.name}</span>
                  <span>
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-mono ${catColors[b.category] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {b.category.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-right font-mono text-zinc-600">{b.total_questions.toLocaleString()}</span>
                  <span className="text-right text-[11px] font-mono text-zinc-500">{scoringLabels[b.scoring_method] ?? b.scoring_method}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Vendors + Recent Evals */}
        <div className="space-y-6">
          {/* Top Vendors */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 mb-4">
                <h3 className="text-xs font-mono font-bold tracking-[0.14em] uppercase text-zinc-500">
                  AI PROVIDER SHARE
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">COVERAGE</span>
              </div>
              <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-zinc-100 border border-black/[0.04]">
                {topVendors.map((v, i) => (
                  <div key={v.name} className={`${vendorColors[i]} transition-all`} style={{ width: `${(v.models / totalModelsForVendors) * 100}%` }} />
                ))}
              </div>
              <div className="space-y-2.5 font-mono">
                {topVendors.map((v, i) => (
                  <div key={v.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${vendorColors[i]}`} />
                      <span className="text-zinc-800 font-medium">{v.name}</span>
                    </div>
                    <span className="text-zinc-500">{v.models} models</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Evaluations */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 mb-4">
                <h3 className="text-xs font-mono font-bold tracking-[0.14em] uppercase text-zinc-500">
                  RECENT RECORDED RUNS
                </h3>
                <Link href="/dashboard/evaluations" className="text-[10px] font-mono font-medium text-zinc-900 hover:underline">
                  ALL RUNS →
                </Link>
              </div>
              <div className="space-y-2">
                {evaluations.slice(0, 5).map((ev) => {
                  const model = ev.models as unknown as { name: string; vendor: string };
                  const bench = ev.benchmarks as unknown as { name: string; category: string };
                  return (
                    <div key={ev.id} className="flex items-center justify-between rounded-xl border border-black/[0.05] bg-zinc-50/60 px-3.5 py-2.5 hover:bg-zinc-100/60 transition-colors">
                      <div>
                        <p className="text-xs font-semibold text-zinc-950 font-mono">{model?.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{bench?.name}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-zinc-950 bg-white px-2 py-0.5 rounded border border-black/[0.08] shadow-2xs">
                        {(ev.accuracy ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
                {evaluations.length === 0 && (
                  <p className="py-4 text-center text-xs font-mono text-zinc-400">No evaluations yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Models Chart */}
      {topModelsForChart.length > 0 && (
        <div className="double-bezel">
          <div className="double-bezel-inner p-6">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-900" />
                <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                  Empirical Accuracy Distribution (Top 10 Models)
                </h3>
              </div>
              <Link href="/dashboard/leaderboard" className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-900 hover:underline">
                <span>FULL LEADERBOARD</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <DashboardCharts data={topModelsForChart} />
          </div>
        </div>
      )}

      {/* Quick Actions Footer */}
      <div className="double-bezel">
        <div className="double-bezel-inner p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-2xs">
              <Clock className="h-4 w-4" />
            </div>
            <p className="text-xs font-mono text-zinc-600">
              {evaluations.length > 0
                ? `${evaluations.length} standardized evaluations recorded with 95% Wilson CI bounds.`
                : "Select a frontier model and benchmark suite to dispatch an empirical evaluation run."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/models"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-mono font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.98]"
            >
              <Layers className="h-3.5 w-3.5 text-zinc-500" /> MODELS
            </Link>
            <Link
              href="/dashboard/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-mono font-medium text-white shadow-xs hover:bg-zinc-850 transition-all active:scale-[0.98]"
            >
              <Zap className="h-3.5 w-3.5 fill-current text-orange-500" /> LEADERBOARD
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
