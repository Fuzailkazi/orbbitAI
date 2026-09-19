import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CheckCircle, Clock, Zap, DollarSign,
  TrendingUp, BarChart2, ShieldCheck, AlertCircle
} from "lucide-react";
import { EvaluationDrilldown } from "./evaluation-drilldown";

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .select("*, models(id, name, vendor, category), benchmarks(id, name, category, scoring_method)")
    .eq("id", id)
    .single();

  if (error || !evaluation) {
    notFound();
  }

  const model = evaluation.models as any;
  const benchmark = evaluation.benchmarks as any;

  // Fetch per-prompt results
  const { data: results } = await supabase
    .from("evaluation_results")
    .select("id, is_correct, score, latency_ms, tokens_used, model_response, judge_reasoning, benchmark_questions(prompt, expected_answer, metadata)")
    .eq("evaluation_id", id)
    .order("created_at", { ascending: true });

  const promptResults = (results ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/dashboard/evaluations"
          className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Evaluations
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">{model?.name} on {benchmark?.name}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {model?.name}
            </h1>
            <Badge variant="outline" className="border-slate-200 text-xs text-slate-600">
              {model?.vendor}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Evaluation Run for benchmark <span className="font-medium text-slate-700">{benchmark?.name}</span> ({benchmark?.category})
          </p>
        </div>

        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle className="mr-1 h-3.5 w-3.5" /> Completed Run
        </Badge>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Accuracy</span>
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {evaluation.accuracy?.toFixed(1)}%
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              95% CI: {evaluation.accuracy_ci_lower?.toFixed(1)}% – {evaluation.accuracy_ci_upper?.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Avg Latency</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {evaluation.avg_latency_ms >= 1000
                ? `${(evaluation.avg_latency_ms / 1000).toFixed(2)}s`
                : `${evaluation.avg_latency_ms}ms`}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              P95: {evaluation.p95_latency_ms ? `${evaluation.p95_latency_ms}ms` : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Throughput</span>
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {evaluation.tokens_per_second ?? "N/A"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              tokens / second
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Cost Profile</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {evaluation.total_cost ? `$${evaluation.total_cost.toFixed(4)}` : "$0.00"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {evaluation.total_tokens ?? 0} total tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Drilldown Section */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Prompt-Level Traceability</h2>
          <p className="text-xs text-slate-500">
            Inspect individual benchmark prompts, model outputs, expected solutions, and scoring decisions.
          </p>
        </div>

        {promptResults.length > 0 ? (
          <EvaluationDrilldown results={promptResults} />
        ) : (
          <Card className="border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No Per-Prompt Traces Available</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              This evaluation was imported from pre-aggregated benchmark datasets. Traceability details will appear for live evaluation runs.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
