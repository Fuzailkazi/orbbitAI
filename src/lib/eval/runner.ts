import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OpenRouterClient,
  OpenRouterError,
  type OpenRouterCompletionResult,
  type OpenRouterErrorKind,
} from "../openrouter/client";
import { isQuotaStop } from "../openrouter/errors";
import { isFreeModelId, resolveJudgeModel } from "../openrouter/free-models";
import { createAdminClient } from "../supabase/admin";
import { getScorer } from "./scorers/factory";
import type { ScoringResult } from "./types";
import {
  calculateWilsonConfidenceInterval,
  calculatePercentile,
  calculateTokensPerSecond,
} from "./statistics";
import {
  EVAL_DEFAULT_CONCURRENCY,
  EVAL_DEFAULT_MAX_TOKENS,
  EVAL_MAX_CALL_TIMEOUT_MS,
  EVAL_MAX_CONCURRENCY,
  EVAL_MAX_SCORING_MS,
  EVAL_MIN_PROMPT_BUDGET_MS,
  EVAL_MIN_SCORING_MS,
  EVAL_RATE_LIMIT_PAUSE_MS,
  EVAL_RUN_BUDGET_MS,
} from "./limits";
import { reapStalledEvaluations } from "./stalled";
import { RequestPacer } from "./batch/pacing";
import { clampConcurrency, runPacedPool } from "./batch/concurrency";
import { requestsPerQuestion } from "./batch/planning";
import type { Benchmark, BenchmarkQuestion, EvaluationResultInsert, Model } from "@/types/database";

/**
 * Why a run stopped before every requested prompt was attempted.
 * - deadline:          the wall-clock budget ran out (API route). Finalized on what ran.
 * - quota:             daily free-model quota / credits exhausted. Finalized as `failed`.
 * - auth:              the API key was rejected. Finalized as `failed`.
 * - model_unavailable: the model left the free tier mid-run. Finalized as `failed`.
 * - interrupted:       the operator stopped the batch (Ctrl-C). Finalized as `failed`.
 */
export type EvaluationStopReason = "deadline" | "quota" | "auth" | "model_unavailable" | "interrupted";

export type EvaluationProgressEvent =
  | {
      type: "init";
      evaluationId: string;
      modelName: string;
      benchmarkName: string;
      totalQuestions: number;
    }
  | {
      type: "question_start";
      index: number;
      total: number;
      promptSnippet: string;
    }
  | {
      type: "question_complete";
      index: number;
      total: number;
      isCorrect: boolean;
      score: number;
      latencyMs: number;
      tokens: number;
      modelResponseSnippet: string;
      costUsd: number;
      /** OpenRouter requests this prompt consumed (model call + judge call, if any). */
      requests: number;
      /** True when the scorer could not produce a verdict (excluded from accuracy, counted in failure rate). */
      unscored?: boolean;
      /** Present when the model call failed (rule 9 — recorded, not retried) or the prompt went unscored. */
      error?: string;
      errorKind?: OpenRouterErrorKind;
    }
  | {
      /** The run stopped before every requested prompt was attempted. */
      type: "truncated";
      reason: EvaluationStopReason;
      questionsRun: number;
      questionsRequested: number;
      message: string;
    }
  | {
      type: "eval_complete";
      output: EvaluationRunOutput;
    }
  | {
      type: "error";
      message: string;
    };

export interface EvaluationRunnerOptions {
  modelId: string;
  benchmarkId: string;
  /** First N questions of the benchmark's fixed sample (ordered by metadata.sample_index). */
  limitQuestions?: number;
  onProgress?: (event: EvaluationProgressEvent) => void | Promise<void>;
  /**
   * Epoch ms after which no new prompt is started. Takes precedence over `deadlineMs`; the API
   * route passes it so pre-flight time counts against its maxDuration.
   */
  deadlineAt?: number;
  /**
   * Wall-clock budget from the start of the run. Default EVAL_RUN_BUDGET_MS (270 s, the API
   * route's budget). `null` = no deadline (batch CLI).
   */
  deadlineMs?: number | null;
  /** Minimum spacing between OpenRouter request starts (ignored when `pacer` is given). */
  minRequestIntervalMs?: number;
  /** Shared pacer so spacing holds across consecutive runs of a batch. */
  pacer?: RequestPacer;
  /** Completion budget per prompt (default EVAL_DEFAULT_MAX_TOKENS). */
  maxTokens?: number;
  /**
   * Prompts in flight at once (default EVAL_DEFAULT_CONCURRENCY, max EVAL_MAX_CONCURRENCY).
   * Starts stay paced by `pacer`, so this overlaps slow calls without raising the request rate.
   * 1 = strictly sequential.
   */
  concurrency?: number;
  /**
   * Graceful stop: no new prompt is started once aborted; in-flight prompts finish and are
   * recorded; the run finalizes as `failed`.
   */
  stopSignal?: AbortSignal;
  /** Hard stop: also aborts the in-flight model calls (those prompts are not counted as attempted). */
  abortSignal?: AbortSignal;
}

export interface EvaluationRunOutput {
  evaluationId: string;
  /**
   * `completed` when at least one prompt was scored and the run was not cut short by quota,
   * auth, model removal or an operator interrupt. Otherwise `failed` (accuracy/CI null).
   */
  status: "completed" | "failed";
  /** Percentage over SCORED prompts; null when status is `failed`. */
  accuracy: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  avgLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  /** Reported usage tokens × model pricing — honestly 0 for free models. */
  totalCost: number;
  tokensPerSecond: number;
  /** (failed calls + unscored prompts) / attempted prompts, as a percentage. */
  failureRate: number;
  /** Prompts actually attempted (a model call was started). */
  questionsEvaluated: number;
  /** Prompts with a real verdict — the accuracy / CI denominator. */
  questionsScored: number;
  questionsCorrect: number;
  /** Model API calls that failed. */
  questionsFailed: number;
  /** Prompts whose model call succeeded but the scorer could not grade. */
  questionsUnscored: number;
  /** questionsFailed + questionsUnscored (everything not in the accuracy denominator). */
  failedCount: number;
  questionsRequested: number;
  /** OpenRouter requests consumed (model calls + judge calls; conservative for judges). */
  requestsUsed: number;
  /** True when the run stopped before every requested prompt was attempted. */
  truncated: boolean;
  stopReason: EvaluationStopReason | null;
  /** True when the daily quota (or credits/auth) is exhausted — a batch must stop. */
  quotaExhausted: boolean;
  /** Human-readable reason when status is `failed` (the table has no column for it). */
  error: string | null;
}

export class EvaluationRunError extends Error {
  readonly code:
    | "MODEL_NOT_FOUND"
    | "BENCHMARK_NOT_FOUND"
    | "NO_QUESTIONS"
    | "MODEL_NOT_FREE"
    | "SELF_JUDGED"
    | "DATABASE_ERROR";
  constructor(code: EvaluationRunError["code"], message: string) {
    super(message);
    this.name = "EvaluationRunError";
    this.code = code;
  }
}

type RunnerModel = Pick<Model, "id" | "name" | "api_identifier" | "pricing_input" | "pricing_output">;
type RunnerBenchmark = Pick<Benchmark, "id" | "name" | "scoring_method" | "source_url">;
type RunnerQuestion = Pick<BenchmarkQuestion, "id" | "prompt" | "expected_answer" | "metadata" | "created_at">;

const SYSTEM_PROMPT =
  "You are an expert AI model taking a standardized benchmark test. Answer accurately, concisely, and directly according to instructions.";

/** Consecutive "model unavailable" failures after which the model is treated as gone. */
const MODEL_UNAVAILABLE_STOP_AFTER = 3;

/** Only imported benchmark questions are ever run (legacy synthetic rows are excluded). */
export const QUESTION_SOURCE = "hf";
/** User-uploaded (BYOD) benchmarks: every question is the user's own data and is runnable. */
export const CUSTOM_BENCHMARK_SOURCE_URL = "custom-upload";

function snippet(text: string, length: number): string {
  return text.slice(0, length).replace(/\n/g, " ");
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return typeof err === "string" && err ? err : "Execution failed";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sampleIndexOf(q: Pick<RunnerQuestion, "metadata">): number {
  const v = q.metadata?.sample_index;
  return typeof v === "number" && Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
}

/** Stable order: metadata.sample_index ascending, then created_at (exported for tests). */
export function orderQuestionsBySample<T extends Pick<RunnerQuestion, "metadata" | "created_at">>(questions: readonly T[]): T[] {
  return [...questions].sort(
    (a, b) => sampleIndexOf(a) - sampleIndexOf(b) || Date.parse(a.created_at) - Date.parse(b.created_at)
  );
}

export interface RunTally {
  attempted: number;
  callFailures: number;
  unscored: number;
  correct: number;
}

export interface RunAggregate {
  scored: number;
  /** null when nothing was scored. */
  accuracy: number | null;
  ci: { lower: number; upper: number } | null;
  failureRate: number;
}

/**
 * Metric definitions (shared by the DB row and the returned output):
 * - questions_evaluated = prompts attempted (a model call was started).
 * - scored              = attempted − failed calls − unscored prompts.
 * - accuracy            = correct / scored × 100; the Wilson CI uses the SAME denominator.
 * - failure_rate        = (failed calls + unscored) / attempted × 100.
 * The table has no `questions_scored` column, so the CI cannot be recomputed from
 * questions_correct / questions_evaluated when failures occurred — the runner stores it.
 */
export function aggregateRun({ attempted, callFailures, unscored, correct }: RunTally): RunAggregate {
  const scored = Math.max(0, attempted - callFailures - unscored);
  const failureRate = attempted > 0 ? round1(((callFailures + unscored) / attempted) * 100) : 0;
  if (scored === 0) return { scored, accuracy: null, ci: null, failureRate };
  return {
    scored,
    accuracy: round1((correct / scored) * 100),
    ci: calculateWilsonConfidenceInterval(correct, scored),
    failureRate,
  };
}

/** Rejects after `ms` so a slow scorer (LLM judge, sandbox) can't hang the run. */
async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isUnscored(result: Pick<ScoringResult, "metadata">): boolean {
  return result.metadata?.unscored === true;
}

/** An OpenRouter error kind a scorer surfaced in its metadata (e.g. the judge hit the daily quota). */
function scorerErrorKind(result: Pick<ScoringResult, "metadata">): OpenRouterErrorKind | null {
  const kind = result.metadata?.errorKind;
  return typeof kind === "string" ? (kind as OpenRouterErrorKind) : null;
}

function stopReasonForKind(kind: OpenRouterErrorKind): EvaluationStopReason | null {
  if (kind === "auth") return "auth";
  if (isQuotaStop(kind)) return "quota";
  return null;
}

const STOP_MESSAGES: Record<EvaluationStopReason, string> = {
  deadline: "Run time limit reached",
  quota: "OpenRouter daily free-model quota exhausted",
  auth: "OpenRouter rejected the API key",
  model_unavailable: "Model is no longer available on the free tier",
  interrupted: "Run interrupted by the operator",
};

/** Marks a still-running evaluation as failed with its attempted count. Never touches completed rows (rule 5). */
async function markFailed(supabase: SupabaseClient, evaluationId: string, attempted: number, correct: number): Promise<void> {
  const { error } = await supabase
    .from("evaluations")
    .update({
      status: "failed",
      questions_evaluated: attempted,
      questions_correct: correct,
      completed_at: new Date().toISOString(),
    })
    .eq("id", evaluationId)
    .eq("status", "running");
  if (error) {
    console.error(`Failed to mark evaluation ${evaluationId} as failed:`, error.message);
  }
}

/**
 * Runs a live evaluation.
 *
 * Robustness contract:
 * - Questions: only imported rows (metadata.source = "hf"), ordered by metadata.sample_index,
 *   first N — a stable prefix, so runs with the same N see the same questions.
 * - Concurrency: up to `concurrency` prompts are in flight; request starts are serialized
 *   through the pacer in question order, so the request rate never exceeds the pacer's. Prompts
 *   may finish out of order; every event carries its question index.
 * - Each per-prompt result is inserted as soon as its prompt finishes, so drill-down
 *   traceability (rule 2) survives an aborted run. That includes failed calls and unscored
 *   prompts (rule 9: failures are recorded with their message, never retried silently).
 * - Deadline (API route): stops starting prompts before the platform kills the function and
 *   finalizes honestly on what ran (`truncated`, still `completed` if anything was scored).
 * - Quota / auth / model removal / operator interrupt: stops starting prompts (in-flight ones
 *   finish and are recorded, or are aborted by `abortSignal`) and finalizes as `failed` — a
 *   cut-short run is never published as if complete.
 * - No prompt scored → `failed` with accuracy/CI null (a 0% there would be noise, not signal).
 * - The row is finalized once, only from `running`, after every in-flight prompt has settled
 *   (rule 5: completed scores are immutable).
 */
export async function runEvaluation({
  modelId,
  benchmarkId,
  limitQuestions = 25,
  onProgress,
  deadlineAt: deadlineAtOption,
  deadlineMs = EVAL_RUN_BUDGET_MS,
  minRequestIntervalMs = 0,
  pacer: sharedPacer,
  maxTokens = EVAL_DEFAULT_MAX_TOKENS,
  concurrency,
  stopSignal,
  abortSignal,
}: EvaluationRunnerOptions): Promise<EvaluationRunOutput> {
  const deadlineAt =
    deadlineAtOption !== undefined
      ? deadlineAtOption
      : deadlineMs === null
        ? Number.POSITIVE_INFINITY
        : Date.now() + deadlineMs;
  const pacer = sharedPacer ?? new RequestPacer(Math.max(0, minRequestIntervalMs));
  const supabase = createAdminClient();

  // 0. Close rows left `running` by killed runs (best-effort; live batch runs are skipped).
  try {
    await reapStalledEvaluations(supabase);
  } catch (reapErr) {
    console.error("Stalled evaluation cleanup failed:", messageOf(reapErr));
  }

  // 1. Fetch model & benchmark
  const { data: modelData, error: modelErr } = await supabase
    .from("models")
    .select("id, name, api_identifier, pricing_input, pricing_output")
    .eq("id", modelId)
    .maybeSingle();

  if (modelErr) throw new EvaluationRunError("DATABASE_ERROR", `Failed to load model: ${modelErr.message}`);
  if (!modelData) throw new EvaluationRunError("MODEL_NOT_FOUND", `Model not found: ${modelId}`);
  const model = modelData as RunnerModel;

  // Defense in depth — the API route and batch CLI also enforce this.
  if (!isFreeModelId(model.api_identifier)) {
    throw new EvaluationRunError(
      "MODEL_NOT_FREE",
      `Live evaluations are limited to free-tier models; "${model.api_identifier}" is not a :free model.`
    );
  }

  const { data: benchmarkData, error: benchErr } = await supabase
    .from("benchmarks")
    .select("id, name, scoring_method, source_url")
    .eq("id", benchmarkId)
    .maybeSingle();

  if (benchErr) throw new EvaluationRunError("DATABASE_ERROR", `Failed to load benchmark: ${benchErr.message}`);
  if (!benchmarkData) throw new EvaluationRunError("BENCHMARK_NOT_FOUND", `Benchmark not found: ${benchmarkId}`);
  const benchmark = benchmarkData as RunnerBenchmark;

  // A model never grades its own answers (self-judging bias).
  if (benchmark.scoring_method === "llm_judge" && model.api_identifier === resolveJudgeModel(process.env.JUDGE_MODEL)) {
    throw new EvaluationRunError(
      "SELF_JUDGED",
      `${model.api_identifier} is the LLM judge for ${benchmark.name}; it cannot grade its own answers. Pick another model (or set JUDGE_MODEL to a different free model).`
    );
  }

  // Resolve the scorer before creating any record (rule 10; throws for unsupported methods).
  const scorer = getScorer(benchmark.scoring_method);
  const requestUnits = requestsPerQuestion(benchmark.scoring_method);

  // 2. Fetch the first N questions of the fixed sample. `metadata->sample_index` compares as
  //    jsonb (numeric for numbers), unlike `->>` which would sort "10" before "2".
  //    Standard benchmarks run imported (hf) questions only; custom uploads run all of theirs.
  let questionQuery = supabase
    .from("benchmark_questions")
    .select("id, prompt, expected_answer, metadata, created_at")
    .eq("benchmark_id", benchmarkId);
  if (benchmark.source_url !== CUSTOM_BENCHMARK_SOURCE_URL) {
    questionQuery = questionQuery.eq("metadata->>source", QUESTION_SOURCE);
  }
  questionQuery = questionQuery
    .order("metadata->sample_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (limitQuestions > 0) {
    questionQuery = questionQuery.limit(limitQuestions);
  }

  const { data: questionData, error: qErr } = await questionQuery;
  if (qErr) throw new EvaluationRunError("DATABASE_ERROR", `Failed to load questions: ${qErr.message}`);
  const questions = orderQuestionsBySample((questionData ?? []) as RunnerQuestion[]);
  if (questions.length === 0) {
    throw new EvaluationRunError(
      "NO_QUESTIONS",
      `Benchmark ${benchmark.name} has no imported questions yet, so it is not runnable.`
    );
  }

  // 3. Create the evaluation record (status: running)
  const { data: evalRecord, error: evalInitErr } = await supabase
    .from("evaluations")
    .insert({
      model_id: modelId,
      benchmark_id: benchmarkId,
      status: "running",
      questions_evaluated: 0,
      questions_correct: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (evalInitErr || !evalRecord) {
    throw new EvaluationRunError(
      "DATABASE_ERROR",
      `Failed to initialize evaluation record: ${evalInitErr?.message ?? "no row returned"}`
    );
  }

  const evaluationId = (evalRecord as { id: string }).id;
  const tally: RunTally = { attempted: 0, callFailures: 0, unscored: 0, correct: 0 };

  /** Persists one prompt's result immediately (rule 2 — survives an aborted run). */
  const recordResult = async (row: EvaluationResultInsert) => {
    const { error } = await supabase.from("evaluation_results").insert(row);
    if (error) {
      throw new EvaluationRunError("DATABASE_ERROR", `Failed to save per-prompt result: ${error.message}`);
    }
  };

  try {
    await onProgress?.({
      type: "init",
      evaluationId,
      modelName: model.name,
      benchmarkName: benchmark.name,
      totalQuestions: questions.length,
    });

    // 4. Execute questions with bounded concurrency. Request STARTS are serialized through the
    //    pacer (in question order); up to `concurrency` calls overlap, and each prompt is
    //    recorded and reported as soon as it finishes, so completion order may differ from
    //    question order (events carry the question index).
    const openRouter = new OpenRouterClient();
    const pricing = { input: Number(model.pricing_input) || 0, output: Number(model.pricing_output) || 0 };

    const latencies: number[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCostUsd = 0;
    let requestsUsed = 0;
    let consecutiveUnavailable = 0;
    let firstFailure: string | null = null;
    let stopReason: EvaluationStopReason | null = null;
    let stopDetail: string | null = null;
    let quotaSeen = false;
    // The first stop wins: a later one (e.g. an in-flight call failing after the deadline stop)
    // does not rewrite why the run was cut short.
    const stopWith = (reason: EvaluationStopReason, detail: string | null = null) => {
      if (reason === "quota" || reason === "auth") quotaSeen = true;
      if (stopReason !== null) return;
      stopReason = reason;
      stopDetail = detail;
    };
    const stopRequested = () => stopSignal?.aborted === true || abortSignal?.aborted === true;
    // Either stop wakes a pacing wait (a rate-limit pause can last up to a minute).
    const stopSignals = [stopSignal, abortSignal].filter((sig): sig is AbortSignal => sig !== undefined);

    await runPacedPool({
      items: questions,
      concurrency: clampConcurrency(concurrency, EVAL_DEFAULT_CONCURRENCY, EVAL_MAX_CONCURRENCY),
      beforeStart: async (_q, _i, poolSignal) => {
        if (stopRequested()) {
          stopWith("interrupted");
          return "stop";
        }
        // Pacing first, then the deadline check against what is actually left.
        await pacer.acquire(requestUnits, AbortSignal.any([...stopSignals, poolSignal]));
        if (poolSignal.aborted) return "stop"; // an in-flight prompt already stopped the run
        if (stopRequested()) {
          stopWith("interrupted");
          return "stop";
        }
        if (deadlineAt - Date.now() < EVAL_MIN_PROMPT_BUDGET_MS) {
          stopWith("deadline");
          return "stop";
        }
        return "continue";
      },
      run: async (q, i) => {
        const index = i + 1;
        const remainingMs = deadlineAt - Date.now();

        await onProgress?.({
          type: "question_start",
          index,
          total: questions.length,
          promptSnippet: snippet(q.prompt, 100),
        });

        let response: OpenRouterCompletionResult;
        try {
          response = await openRouter.createChatCompletion(
            {
              model: model.api_identifier,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: q.prompt },
              ],
              temperature: 0,
              max_tokens: maxTokens,
            },
            pricing,
            { timeoutMs: Math.min(EVAL_MAX_CALL_TIMEOUT_MS, remainingMs), signal: abortSignal }
          );
        } catch (callErr) {
          const kind: OpenRouterErrorKind = callErr instanceof OpenRouterError ? callErr.kind : "other";
          if (kind === "aborted") {
            // Operator hard stop: the prompt never completed, so it is not an attempted prompt.
            stopWith("interrupted");
            return "stop";
          }

          // Rule 9: record the failure with its message; failure rate is a metric. Never retried.
          const message = messageOf(callErr);
          tally.attempted++;
          tally.callFailures++;
          requestsUsed++;
          firstFailure ??= message;
          await recordResult({
            evaluation_id: evaluationId,
            question_id: q.id,
            model_response: `[Error: ${message}]`,
            is_correct: false,
            score: 0,
            latency_ms: 0,
            tokens_used: 0,
            time_to_first_token_ms: null,
            judge_reasoning: `Model API call failed (${kind}): ${message}`,
          });

          await onProgress?.({
            type: "question_complete",
            index,
            total: questions.length,
            isCorrect: false,
            score: 0,
            latencyMs: 0,
            tokens: 0,
            modelResponseSnippet: `[Failed: ${snippet(message, 120)}]`,
            costUsd: 0,
            requests: 1,
            error: message,
            errorKind: kind,
          });

          // Daily quota / auth: cancel pending starts; in-flight prompts finish and are recorded.
          const quotaStop = stopReasonForKind(kind);
          if (quotaStop) {
            stopWith(quotaStop, message);
            return "stop";
          }
          // "Consecutive" in completion order.
          consecutiveUnavailable = kind === "model_unavailable" ? consecutiveUnavailable + 1 : 0;
          if (consecutiveUnavailable >= MODEL_UNAVAILABLE_STOP_AFTER) {
            stopWith("model_unavailable", message);
            return "stop";
          }
          if (kind === "rate_limited_minute") {
            // Pause before the NEXT start; this one stays recorded as failed.
            const suggested = callErr instanceof OpenRouterError ? callErr.retryAfterMs : null;
            pacer.pause(Math.min(EVAL_RATE_LIMIT_PAUSE_MS, Math.max(pacer.intervalMs, suggested ?? EVAL_RATE_LIMIT_PAUSE_MS)));
          }
          return "continue";
        }

        consecutiveUnavailable = 0;
        tally.attempted++;
        // Usage & cost are recorded even if scoring fails — the tokens were spent.
        latencies.push(response.latencyMs);
        totalPromptTokens += response.promptTokens;
        totalCompletionTokens += response.completionTokens;
        totalCostUsd += response.costUsd;
        // Conservative: a judge benchmark is charged its judge call whenever the model answered.
        const promptRequests = requestUnits;
        requestsUsed += promptRequests;

        // Scorers may be async (LLM judge, sandboxed code execution); bound them.
        const scoringBudgetMs = Math.max(EVAL_MIN_SCORING_MS, Math.min(EVAL_MAX_SCORING_MS, deadlineAt - Date.now()));
        // .then() so a scorer that throws synchronously is caught like an async rejection.
        const scoreResult: ScoringResult = await withTimeout(
          Promise.resolve().then(() =>
            scorer.score(response.text, q.expected_answer, q.metadata ?? undefined, { prompt: q.prompt })
          ),
          scoringBudgetMs,
          "Scoring"
        ).catch((scoreErr: unknown) => ({
          isCorrect: false,
          score: 0,
          reasoning: `Scorer error: ${messageOf(scoreErr)}`,
          metadata: { unscored: true },
        }));

        const unscored = isUnscored(scoreResult);
        // A reply cut off at max_tokens is still graded as-is (it is the model's answer), but the
        // trace says so, so a low score can be told apart from a too-small completion budget.
        const cutOffNote =
          response.finishReason === "length" ? ` [Response hit the ${maxTokens}-token completion limit.]` : "";
        if (unscored) {
          tally.unscored++;
          firstFailure ??= scoreResult.reasoning ?? "Scorer could not produce a verdict.";
        } else if (scoreResult.isCorrect) {
          tally.correct++;
        }

        await recordResult({
          evaluation_id: evaluationId,
          question_id: q.id,
          model_response: response.text,
          is_correct: unscored ? false : scoreResult.isCorrect,
          score: unscored ? 0 : scoreResult.score,
          latency_ms: response.latencyMs,
          tokens_used: response.totalTokens,
          time_to_first_token_ms: response.timeToFirstTokenMs,
          judge_reasoning: unscored
            ? `[Unscored] ${scoreResult.reasoning ?? "Scorer could not produce a verdict."}${cutOffNote}`
            : scoreResult.reasoning || cutOffNote
              ? `${scoreResult.reasoning ?? ""}${cutOffNote}`.trim()
              : null,
        });

        const judgeKind = unscored ? scorerErrorKind(scoreResult) : null;
        await onProgress?.({
          type: "question_complete",
          index,
          total: questions.length,
          isCorrect: unscored ? false : scoreResult.isCorrect,
          score: unscored ? 0 : scoreResult.score,
          latencyMs: response.latencyMs,
          tokens: response.totalTokens,
          modelResponseSnippet: snippet(response.text, 80),
          costUsd: response.costUsd,
          requests: promptRequests,
          ...(unscored
            ? { unscored: true, error: `Unscored: ${scoreResult.reasoning ?? "no verdict"}`, errorKind: judgeKind ?? undefined }
            : {}),
        });

        // The judge shares the free-model quota: its quota failure stops the run too.
        const judgeStop = judgeKind ? stopReasonForKind(judgeKind) : null;
        if (judgeStop) {
          stopWith(judgeStop, scoreResult.reasoning ?? null);
          return "stop";
        }
        if (judgeKind === "rate_limited_minute") pacer.pause(EVAL_RATE_LIMIT_PAUSE_MS);
        return "continue";
      },
    });

    // 5. Aggregate statistics over the prompts that actually ran
    const truncated = stopReason !== null && tally.attempted < questions.length;
    if (stopReason !== null) {
      await onProgress?.({
        type: "truncated",
        reason: stopReason,
        questionsRun: tally.attempted,
        questionsRequested: questions.length,
        message:
          stopReason === "deadline"
            ? `Run time limit reached after ${tally.attempted} of ${questions.length} prompts; finalizing on the prompts that ran.`
            : `${STOP_MESSAGES[stopReason]} after ${tally.attempted} of ${questions.length} prompts; the evaluation is marked failed.`,
      });
    }

    const agg = aggregateRun(tally);
    const cutShort = stopReason !== null && stopReason !== "deadline";
    const status: EvaluationRunOutput["status"] = agg.scored > 0 && !cutShort ? "completed" : "failed";
    let failureReason: string | null = null;
    if (status === "failed") {
      if (cutShort && stopReason) {
        failureReason = `${STOP_MESSAGES[stopReason]} after ${tally.attempted} of ${questions.length} prompts (${agg.scored} scored); a partial run is not published.${
          stopDetail ? ` ${snippet(stopDetail, 240)}` : ""
        }`;
      } else if (tally.attempted === 0) {
        failureReason = "The run time limit was reached before any prompt could start.";
      } else {
        failureReason = `No prompt could be scored: ${tally.callFailures} failed ${
          tally.callFailures === 1 ? "call" : "calls"
        }, ${tally.unscored} unscored.${firstFailure ? ` First error: ${snippet(firstFailure, 240)}` : ""}`;
      }
    }

    const accuracy = status === "completed" ? agg.accuracy : null;
    const ci = status === "completed" ? agg.ci : null;
    const totalLatencySum = latencies.reduce((a, b) => a + b, 0);
    const avgLatency = latencies.length > 0 ? Math.round(totalLatencySum / latencies.length) : 0;
    const medianLatency = calculatePercentile(latencies, 50);
    const p95Latency = calculatePercentile(latencies, 95);
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const tokensPerSecond = calculateTokensPerSecond(totalCompletionTokens, totalLatencySum);

    // 6. Finalize exactly once — only a running row can transition (rule 5)
    const { data: finalized, error: finalizeErr } = await supabase
      .from("evaluations")
      .update({
        status,
        accuracy,
        accuracy_ci_lower: ci?.lower ?? null,
        accuracy_ci_upper: ci?.upper ?? null,
        avg_latency_ms: avgLatency,
        median_latency_ms: medianLatency,
        p95_latency_ms: p95Latency,
        total_tokens: totalTokens,
        total_cost: totalCostUsd,
        failure_rate: agg.failureRate,
        tokens_per_second: tokensPerSecond,
        questions_evaluated: tally.attempted,
        questions_correct: tally.correct,
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluationId)
      .eq("status", "running")
      .select("id");

    if (finalizeErr) {
      throw new EvaluationRunError("DATABASE_ERROR", `Failed to finalize evaluation: ${finalizeErr.message}`);
    }
    if (!finalized || finalized.length === 0) {
      throw new EvaluationRunError(
        "DATABASE_ERROR",
        "Evaluation was no longer running when results were finalized; scores were not written."
      );
    }

    const finalOutput: EvaluationRunOutput = {
      evaluationId,
      status,
      accuracy,
      ciLower: ci?.lower ?? null,
      ciUpper: ci?.upper ?? null,
      avgLatencyMs: avgLatency,
      medianLatencyMs: medianLatency,
      p95LatencyMs: p95Latency,
      totalTokens,
      totalCost: totalCostUsd,
      tokensPerSecond,
      failureRate: agg.failureRate,
      questionsEvaluated: tally.attempted,
      questionsScored: agg.scored,
      questionsCorrect: tally.correct,
      questionsFailed: tally.callFailures,
      questionsUnscored: tally.unscored,
      failedCount: tally.callFailures + tally.unscored,
      questionsRequested: questions.length,
      requestsUsed,
      truncated,
      stopReason,
      quotaExhausted: quotaSeen,
      error: failureReason,
    };

    await onProgress?.({ type: "eval_complete", output: finalOutput });

    return finalOutput;
  } catch (err) {
    await markFailed(supabase, evaluationId, tally.attempted, tally.correct);
    throw err;
  }
}
