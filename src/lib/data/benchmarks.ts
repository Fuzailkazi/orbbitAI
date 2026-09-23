import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Benchmark } from "@/types/database";
import { CACHE_PROFILES, CACHE_TAGS } from "./tags";
import { DataQueryError, toNumber } from "./shared";

/** Benchmark row without created_at (no view shows it). */
export type BenchmarkSummary = Omit<Benchmark, "created_at">;

/** A benchmark plus how many prompts the runner can actually send today. */
export type RunnableBenchmark = BenchmarkSummary & {
  /**
   * Standard benchmarks run imported (`metadata.source = "hf"`) questions only — 0 means
   * "not yet runnable"; custom uploads (`source_url = "custom-upload"`) run all of theirs.
   */
  available_questions: number;
};

const BENCHMARK_COLUMNS = "id, name, description, category, scoring_method, total_questions, source_url";
// Mirrors CUSTOM_BENCHMARK_SOURCE_URL / QUESTION_SOURCE in src/lib/eval/runner.ts (not imported to keep
// the runner and its OpenRouter client out of every page bundle that reads benchmarks).
const CUSTOM_UPLOAD_SOURCE = "custom-upload";
const IMPORTED_QUESTION_SOURCE = "hf";

/** Every benchmark, sorted by name. Tag: benchmarks. Profile: catalog. */
export async function getBenchmarks(): Promise<BenchmarkSummary[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.benchmarks);

  const { data, error } = await createPublicClient()
    .from("benchmarks")
    .select(BENCHMARK_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw new DataQueryError("Failed to load benchmarks", error);
  return ((data ?? []) as BenchmarkSummary[]).map((b) => ({
    ...b,
    total_questions: toNumber(b.total_questions),
  }));
}

type RunnableRow = BenchmarkSummary & {
  all_questions: { count: number }[] | null;
  imported_questions: { count: number }[] | null;
};

/**
 * Every benchmark with its runnable prompt count (matches the eval runner's question filter),
 * sorted by name. Tag: benchmarks. Profile: catalog.
 */
export async function getRunnableBenchmarks(): Promise<RunnableBenchmark[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.benchmarks);

  const { data, error } = await createPublicClient()
    .from("benchmarks")
    .select(
      `${BENCHMARK_COLUMNS}, all_questions:benchmark_questions(count), imported_questions:benchmark_questions(count)`
    )
    .eq("imported_questions.metadata->>source", IMPORTED_QUESTION_SOURCE)
    .order("name", { ascending: true });
  if (error) throw new DataQueryError("Failed to load benchmarks", error);
  return ((data ?? []) as RunnableRow[]).map(({ all_questions, imported_questions, ...b }) => ({
    ...b,
    total_questions: toNumber(b.total_questions),
    available_questions:
      b.source_url === CUSTOM_UPLOAD_SOURCE
        ? (all_questions?.[0]?.count ?? 0)
        : (imported_questions?.[0]?.count ?? 0),
  }));
}
