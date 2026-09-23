import type { Metadata } from "next";
import { getActiveModels, getCompletedEvaluations, type CompletedEvaluation } from "@/lib/data";
import { CompareClient, type CompareEvaluation, type CompareModel } from "./compare-client";

export const metadata: Metadata = {
  title: "Compare Models",
  description:
    "Head-to-head benchmark accuracy with Wilson 95% confidence intervals, latency, throughput and pricing for any two models.",
};

/**
 * Keeps only the most recent completed evaluation per (model, benchmark) pair, so
 * re-evaluations (rule 5: new records, never updates) don't double-count. Flattens to the
 * columns the client renders.
 */
function latestPerModelBenchmark(rows: CompletedEvaluation[]): CompareEvaluation[] {
  const latest = new Map<string, CompletedEvaluation>();
  for (const row of rows) {
    const key = `${row.model_id}:${row.benchmark_id}`;
    const prev = latest.get(key);
    const ts = row.completed_at ?? row.created_at;
    if (!prev || ts > (prev.completed_at ?? prev.created_at)) latest.set(key, row);
  }

  const out: CompareEvaluation[] = [];
  for (const row of latest.values()) {
    const bench = row.benchmarks;
    if (!bench) continue;
    out.push({
      id: row.id,
      model_id: row.model_id,
      benchmark_id: row.benchmark_id,
      benchmark_name: bench.name,
      benchmark_category: bench.category,
      benchmark_scoring_method: bench.scoring_method,
      accuracy: row.accuracy,
      accuracy_ci_lower: row.accuracy_ci_lower,
      accuracy_ci_upper: row.accuracy_ci_upper,
      avg_latency_ms: row.avg_latency_ms,
      p95_latency_ms: row.p95_latency_ms,
      tokens_per_second: row.tokens_per_second,
      total_tokens: row.total_tokens,
      total_cost: row.total_cost,
      failure_rate: row.failure_rate,
      questions_evaluated: row.questions_evaluated,
      questions_correct: row.questions_correct,
    });
  }
  return out;
}

/**
 * Static (Cache Components): both reads come from the shared cached data layer, so this page
 * prerenders. The selected pair (?a, ?b, ?model) is URL state read client-side.
 */
export default async function ComparePage() {
  const [catalog, completed] = await Promise.all([getActiveModels(), getCompletedEvaluations()]);

  // Only the fields the pickers and spec rows render (drops release_date from 500+ rows).
  const models: CompareModel[] = catalog.map((m) => ({
    id: m.id,
    name: m.name,
    vendor: m.vendor,
    api_identifier: m.api_identifier,
    category: m.category,
    context_window: m.context_window,
    pricing_input: m.pricing_input,
    pricing_output: m.pricing_output,
  }));
  const evaluations = latestPerModelBenchmark(completed);

  return <CompareClient models={models} evaluations={evaluations} />;
}
