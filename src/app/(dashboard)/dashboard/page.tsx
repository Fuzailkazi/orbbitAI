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
    general: "bg-indigo-50 text-indigo-600",
    code: "bg-emerald-50 text-emerald-600",
    math: "bg-amber-50 text-amber-600",
    chat: "bg-pink-50 text-pink-600",
    reasoning: "bg-violet-50 text-violet-600",
    science: "bg-cyan-50 text-cyan-600",
    factuality: "bg-teal-50 text-teal-600",
    agentic: "bg-orange-50 text-orange-600",
  };

  const vendorColors = ["bg-indigo-500", "bg-indigo-400", "bg-indigo-300", "bg-indigo-200", "bg-indigo-100", "bg-slate-200"];

  // Top 10 models by best accuracy for chart
  const topModelsForChart = evaluations.slice(0, 10).map((ev) => {
    const model = ev.models as unknown as { name: string; vendor: string };
    return {
      name: model?.name ?? "Unknown",
      score: ev.accuracy ?? 0,
      vendor: model?.vendor ?? "Unknown",
    };
  });

  const stats = [
    {
      label: "Total Models",
      value: modelCount.toLocaleString(),
      change: `${vendorCount} vendors`,
      trend: "up" as const,
      footer: "Tracked via OpenRouter",
      icon: Layers,
    },
    {
      label: "Benchmarks",
      value: benchmarks.length.toLocaleString(),
      change: `${spaceCount} spaces`,
      trend: "up" as const,
      footer: "Active test suites",
      icon: BookOpen,
    },
    {
      label: "Evaluations",
      value: evaluations.length.toLocaleString(),
      change: evaluations.length > 0 ? "Completed" : "Ready",
      trend: evaluations.length > 0 ? ("up" as const) : ("neutral" as const),
      footer: evaluations.length > 0 ? "Across models & benchmarks" : "Run your first eval",
      icon: Play,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <Badge variant="outline" className={`text-xs font-semibold ${stat.trend === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  {stat.trend === "up" && <ArrowUpRight className="mr-0.5 h-3 w-3" />}
                  {stat.change}
                </Badge>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {stat.value}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Info className="h-3 w-3" />
                <span>{stat.footer}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Benchmarks table */}
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <CardTitle className="text-sm font-semibold text-slate-900">Available Benchmarks</CardTitle>
            </div>
            <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{benchmarks.length} total</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-4 gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Benchmark</span>
                <span>Category</span>
                <span className="text-right">Questions</span>
                <span className="text-right">Scoring</span>
              </div>
              {benchmarks.map((b) => (
                <div key={b.id} className="grid grid-cols-4 items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{b.name}</span>
                  <span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColors[b.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {b.category}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs text-slate-500">{b.total_questions.toLocaleString()}</span>
                  <span className="text-right text-xs text-slate-400">{scoringLabels[b.scoring_method] ?? b.scoring_method}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Top Vendors */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Top Vendors</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="mb-4 flex h-2.5 overflow-hidden rounded-full">
                {topVendors.map((v, i) => (
                  <div key={v.name} className={`${vendorColors[i]} transition-all`} style={{ width: `${(v.models / totalModelsForVendors) * 100}%` }} />
                ))}
              </div>
              <div className="space-y-2.5">
                {topVendors.map((v, i) => (
                  <div key={v.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${vendorColors[i]}`} />
                      <span className="text-slate-700">{v.name}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-500">{v.models} models</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Evals */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Top Evaluations</CardTitle>
              <Link href="/dashboard/evaluations" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View All</Link>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-2.5">
                {evaluations.slice(0, 5).map((ev) => {
                  const model = ev.models as unknown as { name: string; vendor: string };
                  const bench = ev.benchmarks as unknown as { name: string; category: string };
                  return (
                    <div key={ev.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{model?.name}</p>
                        <p className="text-[10px] text-slate-400">{bench?.name}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-indigo-600">{(ev.accuracy ?? 0).toFixed(1)}%</span>
                    </div>
                  );
                })}
                {evaluations.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">No evaluations yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Models Chart */}
      {topModelsForChart.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <CardTitle className="text-sm font-semibold text-slate-900">Top Models by Accuracy</CardTitle>
            </div>
            <Link href="/dashboard/leaderboard" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Full Leaderboard <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-5">
            <DashboardCharts data={topModelsForChart} />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-xs text-slate-500">
            {evaluations.length > 0
              ? `${evaluations.length} evaluations complete. Compare models or explore the leaderboard.`
              : "Ready to evaluate? Choose a model and benchmark to run your first evaluation."}
          </p>
          <div className="ml-auto flex gap-2">
            <Link href="/dashboard/models" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <Layers className="h-3.5 w-3.5" /> Browse Models
            </Link>
            <Link href="/dashboard/leaderboard" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              <Zap className="h-3.5 w-3.5" /> Leaderboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
