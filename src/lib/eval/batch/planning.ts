/**
 * Pure planning for the evaluation batch CLI: which (model, benchmark) pairs to run, how many
 * OpenRouter requests they cost, and how many fit in today's free-tier budget.
 */

/** A benchmark needs at least this many imported questions to be runnable at all. */
export const MIN_RUNNABLE_QUESTIONS = 20;

/** Requests the key counter may lag behind by; kept unused so a pair never overshoots the quota. */
export const KEY_SAFETY_RESERVE = 2;

export interface PlanModel {
  id: string;
  name: string;
  api_identifier: string;
}

export interface PlanBenchmark {
  id: string;
  name: string;
  scoring_method: string;
  /** Count of imported questions (metadata.source = "hf"). */
  hfQuestions: number;
}

export interface CompletedEvaluationRef {
  model_id: string;
  benchmark_id: string;
  questions_evaluated: number;
}

export interface PlannedPair {
  model: PlanModel;
  benchmark: PlanBenchmark;
  questions: number;
  estimatedRequests: number;
}

export interface SkippedBenchmark {
  benchmark: PlanBenchmark;
  reason: string;
}

export interface SkippedPair {
  model: PlanModel;
  benchmark: PlanBenchmark;
  reason: string;
}

export interface BatchPlan {
  pairs: PlannedPair[];
  skippedBenchmarks: SkippedBenchmark[];
  skippedPairs: SkippedPair[];
  totalRequests: number;
}

/**
 * OpenRouter requests per question: the model call, plus one judge call for llm_judge
 * benchmarks (the judge is also a free-tier model and shares the same quota).
 */
export function requestsPerQuestion(scoringMethod: string): number {
  return scoringMethod === "llm_judge" ? 2 : 1;
}

/** Questions a pair runs: the first `n` of the fixed sample, or all imported if fewer. */
export function questionsForBenchmark(hfQuestions: number, n: number): number {
  return Math.max(0, Math.min(n, hfQuestions));
}

export interface RunnableOptions {
  n: number;
  isSupportedMethod: (method: string) => boolean;
}

/** Splits benchmarks into runnable and skipped (with a reason each). */
export function selectRunnableBenchmarks(
  benchmarks: readonly PlanBenchmark[],
  { n, isSupportedMethod }: RunnableOptions
): { runnable: PlanBenchmark[]; skipped: SkippedBenchmark[] } {
  const runnable: PlanBenchmark[] = [];
  const skipped: SkippedBenchmark[] = [];
  for (const b of benchmarks) {
    if (!isSupportedMethod(b.scoring_method)) {
      skipped.push({ benchmark: b, reason: `scoring method "${b.scoring_method}" has no registered scorer` });
    } else if (b.hfQuestions < Math.min(MIN_RUNNABLE_QUESTIONS, n)) {
      skipped.push({
        benchmark: b,
        reason:
          b.hfQuestions === 0
            ? "no imported questions (not yet runnable)"
            : `only ${b.hfQuestions} imported questions (< ${Math.min(MIN_RUNNABLE_QUESTIONS, n)})`,
      });
    } else {
      runnable.push(b);
    }
  }
  return { runnable, skipped };
}

function pairKey(modelId: string, benchmarkId: string): string {
  return `${modelId}:${benchmarkId}`;
}

/**
 * Builds the ordered pair list. Benchmarks are ordered cheapest-per-question first (judge
 * benchmarks cost double), then by name; each benchmark runs across all models before the
 * next, so the leaderboard fills in whole columns. Pairs that already have a completed
 * evaluation covering the requested sample are skipped (resumable).
 */
export function planBatch(
  models: readonly PlanModel[],
  benchmarks: readonly PlanBenchmark[],
  completed: readonly CompletedEvaluationRef[],
  n: number
): Omit<BatchPlan, "skippedBenchmarks"> {
  const best = new Map<string, number>();
  for (const c of completed) {
    const key = pairKey(c.model_id, c.benchmark_id);
    best.set(key, Math.max(best.get(key) ?? 0, c.questions_evaluated));
  }

  const ordered = [...benchmarks].sort(
    (a, b) => requestsPerQuestion(a.scoring_method) - requestsPerQuestion(b.scoring_method) || a.name.localeCompare(b.name)
  );

  const pairs: PlannedPair[] = [];
  const skippedPairs: SkippedPair[] = [];
  for (const benchmark of ordered) {
    const questions = questionsForBenchmark(benchmark.hfQuestions, n);
    for (const model of models) {
      const done = best.get(pairKey(model.id, benchmark.id));
      if (done !== undefined && done >= questions) {
        skippedPairs.push({ model, benchmark, reason: `already completed with ${done} questions` });
        continue;
      }
      pairs.push({
        model,
        benchmark,
        questions,
        estimatedRequests: questions * requestsPerQuestion(benchmark.scoring_method),
      });
    }
  }
  return { pairs, skippedPairs, totalRequests: pairs.reduce((sum, p) => sum + p.estimatedRequests, 0) };
}

export interface DailyBudgetInput {
  /** --daily-cap */
  dailyCap: number;
  /** Requests this tool already made today (local ledger). */
  localUsedToday: number;
  /** Account-wide counter from GET /api/v1/key, when reachable. */
  key: { limit: number; remaining: number } | null;
}

/** Daily request capacity: the smaller of --daily-cap and the account's free-model limit. */
export function effectiveDailyCapacity({ dailyCap, key }: Pick<DailyBudgetInput, "dailyCap" | "key">): number {
  const cap = Math.max(0, Math.floor(dailyCap));
  return key ? Math.min(cap, Math.max(0, key.limit - KEY_SAFETY_RESERVE)) : cap;
}

/** Requests still allowed today. */
export function remainingDailyBudget({ dailyCap, localUsedToday, key }: DailyBudgetInput): number {
  const local = Math.max(0, Math.floor(dailyCap) - Math.max(0, localUsedToday));
  if (!key) return local;
  return Math.max(0, Math.min(local, key.remaining - KEY_SAFETY_RESERVE));
}

/** Whole days needed to spend `totalRequests` at `dailyCapacity` per day (Infinity if impossible). */
export function estimateDays(totalRequests: number, dailyCapacity: number): number {
  if (totalRequests <= 0) return 0;
  if (dailyCapacity <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(totalRequests / dailyCapacity);
}

/**
 * The prefix of `pairs` that fits in `budget` requests (after `maxEvals`), plus the first pair
 * that did not fit. The batch stops before a pair that would exceed the budget rather than
 * starting a run it cannot finish.
 */
export function fitPairsToBudget(
  pairs: readonly PlannedPair[],
  budget: number,
  maxEvals: number | null
): { runnable: PlannedPair[]; blockedBy: PlannedPair | null; usedRequests: number } {
  const runnable: PlannedPair[] = [];
  let used = 0;
  for (const pair of pairs) {
    if (maxEvals !== null && runnable.length >= maxEvals) break;
    if (used + pair.estimatedRequests > budget) return { runnable, blockedBy: pair, usedRequests: used };
    runnable.push(pair);
    used += pair.estimatedRequests;
  }
  return { runnable, blockedBy: null, usedRequests: used };
}

/** True when a single pair can never fit in one day at this capacity. */
export function pairExceedsDailyCapacity(pair: PlannedPair, dailyCapacity: number): boolean {
  return pair.estimatedRequests > dailyCapacity;
}
