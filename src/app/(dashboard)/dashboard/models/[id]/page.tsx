import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import type { Model } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Globe, Cpu, DollarSign, Tag, Calendar, Zap, BarChart3,
} from "lucide-react";

const categoryColors: Record<string, string> = {
  chat: "bg-indigo-50 text-indigo-600",
  reasoning: "bg-violet-50 text-violet-600",
  code: "bg-emerald-50 text-emerald-600",
  vision: "bg-amber-50 text-amber-600",
  moe: "bg-pink-50 text-pink-600",
  embedding: "bg-cyan-50 text-cyan-600",
  transformer: "bg-slate-100 text-slate-600",
};

function formatContext(ctx: number): string {
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M tokens`;
  return `${(ctx / 1000).toFixed(0)}K tokens`;
}

function formatPrice(price: number): string {
  return price === 0 ? "Free" : `$${price} / 1M tokens`;
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: model, error } = await supabase
    .from("models").select("*").eq("id", id).single();

  if (error || !model) notFound();

  const m = model as Model;

  // Fetch evaluations for this model
  const { data: evals } = await supabase
    .from("evaluations")
    .select("*, benchmarks(name, category)")
    .eq("model_id", id)
    .eq("status", "completed")
    .order("accuracy", { ascending: false });

  const evaluations = evals ?? [];

  const details = [
    { label: "Vendor", value: m.vendor, icon: Globe },
    { label: "Category", value: m.category, icon: Tag },
    { label: "Context Window", value: formatContext(m.context_window), icon: Cpu },
    { label: "Input Pricing", value: formatPrice(m.pricing_input), icon: DollarSign },
    { label: "Output Pricing", value: formatPrice(m.pricing_output), icon: DollarSign },
    { label: "Released", value: m.release_date ? new Date(m.release_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/models" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Models
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{m.name}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColors[m.category] ?? "bg-slate-100 text-slate-600"}`}>{m.category}</span>
          </div>
          <p className="mt-1 font-mono text-sm text-slate-400">{m.api_identifier}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/compare?model=${m.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">Compare</Link>
          <Link href={`/dashboard/evaluations?model=${m.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"><Zap className="h-3.5 w-3.5" /> Run Evaluation</Link>
        </div>
      </div>

      {m.description && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm leading-relaxed text-slate-600">{m.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Details grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {details.map((d) => (
          <Card key={d.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <d.icon className="h-4 w-4 text-slate-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{d.label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{d.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tags */}
      {m.tags.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900">Tags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {m.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">{tag}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Evaluations */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-sm font-semibold text-slate-900">Benchmark Results</CardTitle>
          <Badge variant="outline" className="ml-auto border-slate-200 text-slate-500">{evaluations.length} benchmarks</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {evaluations.length > 0 ? (
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-6 gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Benchmark</span>
                <span className="text-right">Accuracy</span>
                <span className="text-right">CI (95%)</span>
                <span className="text-right">Avg Latency</span>
                <span className="text-right">TPS</span>
                <span className="text-right">P95</span>
              </div>
              {evaluations.map((ev: Record<string, unknown>) => {
                const bench = ev.benchmarks as { name: string; category: string } | null;
                return (
                  <div key={ev.id as string} className="grid grid-cols-6 items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                    <span className="font-medium text-slate-800">{bench?.name ?? "Unknown"}</span>
                    <span className="text-right">
                      <span className="font-mono font-semibold text-slate-900">{(ev.accuracy as number).toFixed(1)}%</span>
                    </span>
                    <span className="text-right font-mono text-[10px] text-slate-400">
                      {(ev.accuracy_ci_lower as number).toFixed(1)}–{(ev.accuracy_ci_upper as number).toFixed(1)}%
                    </span>
                    <span className="text-right font-mono text-xs text-slate-500">
                      {(ev.avg_latency_ms as number) >= 1000 ? `${((ev.avg_latency_ms as number) / 1000).toFixed(1)}s` : `${ev.avg_latency_ms}ms`}
                    </span>
                    <span className="text-right font-mono text-xs text-slate-500">{ev.tokens_per_second as number}</span>
                    <span className="text-right font-mono text-xs text-slate-400">
                      {(ev.p95_latency_ms as number) >= 1000 ? `${((ev.p95_latency_ms as number) / 1000).toFixed(1)}s` : `${ev.p95_latency_ms}ms`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No evaluations yet for {m.name}.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
