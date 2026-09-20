import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Layers, BookOpen, Play, ArrowRight,
  Clock, Info, BarChart3,
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

  // Scoring method display
  const scoringLabels: Record<string, string> = {
    exact_match: "Exact Match",
    normalized_match: "Normalized",
    pass_at_k: "Pass@k",
    llm_judge: "LLM Judge",
    bleu: "BLEU",
    rouge: "ROUGE",
  };
  
  // Update vendor colors to semantic standard
  const vendorColors = ["bg-primary", "bg-primary/80", "bg-primary/60", "bg-primary/40", "bg-primary/30", "bg-primary/20"];

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
      label: "Total Models",
      value: modelCount.toLocaleString(),
      icon: Layers,
    },
    {
      label: "Benchmark Suites",
      value: benchmarks.length.toLocaleString(),
      icon: BookOpen,
    },
    {
      label: "Evaluations",
      value: evaluations.length.toLocaleString(),
      icon: Play,
    },
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-16 font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/evaluate"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Run evaluation</span>
          </Link>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-6 shadow-sm hover:border-border/80 hover:shadow-sm transition-all">
            <stat.icon className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            <p className="text-3xl font-semibold font-mono tabular-nums mt-1 text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* 3. Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Top Models chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-6">Top performing models</h2>
          {topModelsForChart.length > 0 ? (
            <DashboardCharts data={topModelsForChart} />
          ) : (
            <p className="text-sm text-muted-foreground">No evaluations recorded yet.</p>
          )}
        </div>

        {/* Right: Provider distribution */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-6">Provider distribution</h2>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted border border-border">
            {topVendors.map((v, i) => (
              <div key={v.name} className={`${vendorColors[i]} transition-all`} style={{ width: `${(v.models / totalModelsForVendors) * 100}%` }} />
            ))}
          </div>
          <div className="space-y-3">
            {topVendors.map((v, i) => (
              <div key={v.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${vendorColors[i]}`} />
                  <span className="text-foreground font-medium">{v.name}</span>
                </div>
                <span className="text-muted-foreground tabular-nums font-mono">{v.models} models</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 4. Benchmark Suites Table */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active benchmark suites</h2>
          <div className="divide-y divide-border">
            <div className="grid grid-cols-4 gap-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              <span>Benchmark</span>
              <span>Category</span>
              <span className="text-right">Questions</span>
              <span className="text-right">Scoring Engine</span>
            </div>
            {benchmarks.map((b) => (
              <div key={b.id} className="grid grid-cols-4 items-center gap-4 py-3 text-sm transition-colors hover:bg-muted/50">
                <span className="font-medium text-foreground">{b.name}</span>
                <span>
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-foreground border border-border capitalize">
                    {b.category}
                  </span>
                </span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{b.total_questions.toLocaleString()}</span>
                <span className="text-right text-muted-foreground">{scoringLabels[b.scoring_method] ?? b.scoring_method}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Recent Evaluations List */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent evaluations</h2>
            <Link href="/dashboard/evaluations" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {evaluations.slice(0, 5).map((ev) => {
              const model = ev.models as unknown as { name: string; vendor: string };
              const bench = ev.benchmarks as unknown as { name: string; category: string };
              return (
                <div key={ev.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:border-border/80 hover:shadow-sm transition-all">
                  <div>
                    <p className="text-sm font-medium text-foreground">{model?.name}</p>
                    <p className="text-xs text-muted-foreground">{bench?.name}</p>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-semibold text-foreground bg-muted px-2 py-1 rounded-md">
                    {(ev.accuracy ?? 0).toFixed(1)}%
                  </span>
                </div>
              );
            })}
            {evaluations.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No evaluations yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* 6. Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/dashboard/models" className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-between hover:border-border/80 hover:shadow-md transition-all active:scale-[0.98]">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Layers className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Browse models</p>
              <p className="text-sm text-muted-foreground">Explore available AI models and their capabilities</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
        
        <Link href="/dashboard/leaderboard" className="bg-card border border-border rounded-xl p-6 shadow-sm flex items-center justify-between hover:border-border/80 hover:shadow-md transition-all active:scale-[0.98]">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">View leaderboard</p>
              <p className="text-sm text-muted-foreground">Compare model performance across benchmark suites</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
