/**
 * Cached, shared read layer (Cache Components). Server-only: import from Server Components,
 * route handlers or server actions — never from "use client" files.
 *
 * Everything here reads PUBLIC data through the cookie-less anon client (RLS still applies)
 * and is cached with "use cache" + cacheTag/cacheLife. Per-user data, in-flight evaluations and
 * prompt-level drill-down (evaluation_results) are deliberately NOT here — they stay uncached.
 * Invalidate with the helpers in ./revalidate after writes.
 */
export {
  getActiveModels,
  getFreeModels,
  getModelById,
  getCatalogCounts,
  type CatalogModel,
  type FreeModel,
  type CatalogCounts,
} from "./models";
export {
  getBenchmarks,
  getRunnableBenchmarks,
  type BenchmarkSummary,
  type RunnableBenchmark,
} from "./benchmarks";
export {
  getCompletedEvaluations,
  getCompletedEvaluationsForModel,
  latestPerModelBenchmark,
  evaluationTimestamp,
  type CompletedEvaluation,
  type EvaluationModelRef,
  type EvaluationBenchmarkRef,
} from "./evaluations";
export {
  getSpaces,
  getSpacesWithBenchmarks,
  type SpaceBenchmarkRef,
  type SpaceWithBenchmarks,
} from "./spaces";
export { CACHE_TAGS, CACHE_PROFILES, type CacheTag } from "./tags";
