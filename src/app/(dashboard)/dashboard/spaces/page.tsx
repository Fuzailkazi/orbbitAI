import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Calculator, Code, Brain, MessageCircle, CheckCircle, Bot,
  ArrowRight, BarChart3,
} from "lucide-react";

const spaceIcons: Record<string, typeof Calculator> = {
  calculator: Calculator, code: Code, brain: Brain,
  "message-circle": MessageCircle, "check-circle": CheckCircle, bot: Bot,
};

const spaceColors: Record<string, { bg: string; border: string; icon: string }> = {
  Mathematics: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600" },
  "Code Generation": { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600" },
  Reasoning: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-600" },
  "Chat Quality": { bg: "bg-pink-50", border: "border-pink-200", icon: "text-pink-600" },
  Factuality: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "text-cyan-600" },
  Agentic: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-600" },
};

export default async function SpacesPage() {
  const supabase = await createServerClient();
  const { data: spaces } = await supabase.from("spaces").select("*").order("name");
  const { data: benchmarks } = await supabase.from("benchmarks").select("id, name");
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("benchmark_id, accuracy, models(name)")
    .eq("status", "completed");

  const benchmarkMap = new Map((benchmarks ?? []).map((b) => [b.id, b.name]));

  const spaceStats = (spaces ?? []).map((space) => {
    const ids: string[] = space.benchmark_ids ?? [];
    const names = ids.map((id) => benchmarkMap.get(id)).filter(Boolean);
    const evals = (evaluations ?? []).filter((e) => ids.includes(e.benchmark_id));
    const avg = evals.length > 0 ? evals.reduce((s, e) => s + (e.accuracy ?? 0), 0) / evals.length : null;
    const top = evals.length > 0 ? evals.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0] : null;
    return { space, names, count: evals.length, avg, top };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Eval Spaces</h1>
        <p className="mt-1 text-sm text-slate-500">Curated benchmark groups. {spaces?.length ?? 0} spaces, {evaluations?.length ?? 0} evaluations.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaceStats.map(({ space, names, count, avg, top }) => {
          const c = spaceColors[space.name] ?? { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-600" };
          const Icon = spaceIcons[space.icon] ?? BarChart3;
          return (
            <Card key={space.id} className={`border shadow-sm transition-all hover:shadow-md ${c.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
                    <Icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{names.length} benchmarks</Badge>
                </div>
                <CardTitle className="mt-3 text-base font-semibold text-slate-900">{space.name}</CardTitle>
                <p className="text-xs text-slate-500">{space.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {names.map((n) => (
                    <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{n}</span>
                  ))}
                </div>
                {count > 0 ? (
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avg Accuracy</span>
                      <span className="font-mono font-semibold text-slate-900">{avg?.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Evaluations</span>
                      <span className="font-mono text-slate-700">{count}</span>
                    </div>
                    {top && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Top Model</span>
                        <span className="font-medium text-indigo-600">{(top.models as unknown as { name: string })?.name}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No evaluations yet.</p>
                )}
                <Link href="/dashboard/leaderboard" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  View Leaderboard <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
