import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Benchmark, Evaluation, Model } from "@/types/database";
import { CACHE_PROFILES, CACHE_TAGS } from "./tags";
import { DataQueryError, firstOrNull, toNumber, toNumberOrNull } from "./shared";

/** Model fields joined onto a completed evaluation (superset of what every aggregate view shows). */
export type EvaluationModelRef = Pick<
  Model,
  "id" | "name" | "vendor" | "category" | "api_identifier" | "pricing_input" | "pricing_output" | "context_window"
>;

/** Benchmark fields joined onto a completed evaluation. */
export type EvaluationBenchmarkRef = Pick<Benchmark, "id" | "name" | "category" | "scoring_method" | "description">;

/**
 * A completed evaluation with its model and benchmark. Scores are immutable once completed
 * (rule 5), which is what makes this safe to cache. Joined keys keep Supabase's embed names
 * (`models`, `benchmarks`) so existing page code maps over it unchanged.
 */
export type CompletedEvaluation = Omit<Evaluation, "status"> & {
  status: "completed";
  models: EvaluationModelRef | null;
  benchmarks: EvaluationBenchmarkRef | null;
};

const EVALUATION_COLUMNS =
  "id, model_id, benchmark_id, status, accuracy, accuracy_ci_lower, accuracy_ci_upper, avg_latency_ms, median_latency_ms, p95_latency_ms, total_tokens, total_cost, failure_rate, tokens_per_second, questions_evaluated, questions_correct, started_at, completed_at, created_at";
const MODEL_REF_COLUMNS = "id, name, vendor, category, api_identifier, pricing_input, pricing_output, context_window";
const BENCHMARK_REF_COLUMNS = "id, name, category, scoring_method, description";

type RawCompletedEvaluation = Omit<CompletedEvaluation, "models" | "benchmarks"> & {
  models: EvaluationModelRef | EvaluationModelRef[] | null;
  benchmarks: EvaluationBenchmarkRef | EvaluationBenchmarkRef[] | null;
};

function normalizeEvaluation(row: RawCompletedEvaluation): CompletedEvaluation {
  const model = firstOrNull(row.models);
  return {
    ...row,
    status: "completed",
    accuracy: toNumberOrNull(row.accuracy),
    accuracy_ci_lower: toNumberOrNull(row.accuracy_ci_lower),
    accuracy_ci_upper: toNumberOrNull(row.accuracy_ci_upper),
    avg_latency_ms: toNumberOrNull(row.avg_latency_ms),
    median_latency_ms: toNumberOrNull(row.median_latency_ms),
    p95_latency_ms: toNumberOrNull(row.p95_latency_ms),
    total_tokens: toNumberOrNull(row.total_tokens),
    total_cost: toNumberOrNull(row.total_cost),
    failure_rate: toNumberOrNull(row.failure_rate),
    tokens_per_second: toNumberOrNull(row.tokens_per_second),
    questions_evaluated: toNumber(row.questions_evaluated),
    questions_correct: toNumber(row.questions_correct),
    models: model
      ? {
          ...model,
          pricing_input: toNumber(model.pricing_input),
          pricing_output: toNumber(model.pricing_output),
          context_window: toNumber(model.context_window),
        }
      : null,
    benchmarks: firstOrNull(row.benchmarks),
  };
}

/**
 * Every completed evaluation with its model + benchmark, ordered by accuracy (highest first,
 * nulls last), then most recently completed. One shared cache entry feeds the overview,
 * leaderboard, compare, spaces, model detail and landing views.
 *
 * Tags: evaluations, models, benchmarks (joined names change on sync). Profile: evaluations.
 * Never includes pending/running/failed rows — those stay uncached on the evaluations page.
 */
export async function getCompletedEvaluations(): Promise<CompletedEvaluation[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.evaluations);
  cacheTag(CACHE_TAGS.evaluations, CACHE_TAGS.models, CACHE_TAGS.benchmarks);

  const { data, error } = await createPublicClient()
    .from("evaluations")
    .select(`${EVALUATION_COLUMNS}, models(${MODEL_REF_COLUMNS}), benchmarks(${BENCHMARK_REF_COLUMNS})`)
    .eq("status", "completed")
    .order("accuracy", { ascending: false, nullsFirst: false })
    .order("completed_at", { ascending: false, nullsFirst: false });
  if (error) throw new DataQueryError("Failed to load evaluations", error);
  return ((data ?? []) as unknown as RawCompletedEvaluation[]).map(normalizeEvaluation);
}

/** Completed evaluations of one model (same order and cache entry as getCompletedEvaluations). */
export async function getCompletedEvaluationsForModel(modelId: string): Promise<CompletedEvaluation[]> {
  const evaluations = await getCompletedEvaluations();
  return evaluations.filter((ev) => ev.model_id === modelId);
}

/** Timestamp used to decide which of two runs is newer (completion time, else creation time). */
export function evaluationTimestamp(ev: Pick<Evaluation, "completed_at" | "created_at">): number {
  return new Date(ev.completed_at ?? ev.created_at).getTime();
}

/**
 * Latest completed run per (model, benchmark) pair — the "current" score a comparison should use.
 * Input order is preserved for the survivors.
 */
export function latestPerModelBenchmark<T extends Pick<Evaluation, "model_id" | "benchmark_id" | "completed_at" | "created_at">>(
  evaluations: readonly T[]
): T[] {
  const latest = new Map<string, T>();
  for (const ev of evaluations) {
    const key = `${ev.model_id}:${ev.benchmark_id}`;
    const existing = latest.get(key);
    if (!existing || evaluationTimestamp(ev) > evaluationTimestamp(existing)) latest.set(key, ev);
  }
  const keep = new Set(latest.values());
  return evaluations.filter((ev) => keep.has(ev));
}
