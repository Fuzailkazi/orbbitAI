import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";

export default async function EvaluationsPage() {
  const supabase = await createServerClient();

  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("*, models(id, name, vendor), benchmarks(name, category)")
    .eq("status", "completed")
    .order("accuracy", { ascending: false });

  const evals = evaluations ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Evaluations</h1>
          <p className="mt-1 text-sm text-slate-500">{evals.length} completed evaluations across models and benchmarks.</p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle className="mr-1 h-3 w-3" /> {evals.length} completed
        </Badge>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Model</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Benchmark</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accuracy</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">CI (95%)</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avg Latency</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">TPS</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {evals.map((ev) => {
                  const model = ev.models as { id: string; name: string; vendor: string } | null;
                  const bench = ev.benchmarks as { name: string; category: string } | null;
                  return (
                    <tr key={ev.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/models/${model?.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors">
                          {model?.name ?? "Unknown"}
                        </Link>
                        <p className="text-[10px] text-slate-400">{model?.vendor}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{bench?.name ?? "Unknown"}</td>
                      <td className="px-5 py-3 text-right font-mono text-sm font-semibold text-slate-900">
                        {ev.accuracy?.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[10px] text-slate-400">
                        {ev.accuracy_ci_lower?.toFixed(1)}–{ev.accuracy_ci_upper?.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                        {ev.avg_latency_ms >= 1000 ? `${(ev.avg_latency_ms / 1000).toFixed(1)}s` : `${ev.avg_latency_ms}ms`}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">{ev.tokens_per_second}</td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-600">
                          <CheckCircle className="mr-0.5 h-2.5 w-2.5" /> Completed
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock className="h-3 w-3" />
        <span>Evaluation data sourced from public benchmarks (HuggingFace, official papers).</span>
      </div>
    </div>
  );
}
