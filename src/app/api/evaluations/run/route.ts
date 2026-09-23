import { after, NextRequest, NextResponse } from "next/server";
import {
  runEvaluation,
  EvaluationRunError,
  type EvaluationProgressEvent,
  type EvaluationRunOutput,
} from "@/lib/eval/runner";
import { isFreeModelId } from "@/lib/openrouter/free-models";
import { createRouteHandlerClient } from "@/lib/supabase/route";
import { AdminConfigError } from "@/lib/supabase/admin";
import { requireApiSession } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { EVAL_DEFAULT_CONCURRENCY, EVAL_RUN_BUDGET_MS } from "@/lib/eval/limits";
import { revalidateEvaluations } from "@/lib/data/revalidate";
import { intervalForRpm } from "@/lib/eval/batch/pacing";
import {
  apiError,
  databaseErrorResponse,
  errorMessage,
  isUuid,
  readJsonObject,
  type ApiErrorBody,
} from "@/lib/api/responses";

// Paced prompts against free-tier models can take a while. Must equal
// EVAL_MAX_DURATION_MS / 1000 (lib/eval/limits.ts) — Next.js requires a literal here.
// The runner stops starting prompts EVAL_FINALIZE_MARGIN_MS before this limit and finalizes
// on what ran, so the row is never left "running" by a platform timeout.
export const maxDuration = 300;

const DEFAULT_QUESTIONS = 10;
// Matches the largest sample the UI offers. Longer runs are still bounded by the wall-clock
// deadline (EVAL_RUN_BUDGET_MS), which truncates and finalizes honestly if time runs out.
const MAX_QUESTIONS = 25;
// Free models allow 20 requests/minute per account; space request starts so a UI run does not
// burn prompts on per-minute 429s (each would be recorded as a failure — rule 9).
const ROUTE_REQUEST_INTERVAL_MS = intervalForRpm(18);
// Prompts in flight at once. Starts stay spaced by ROUTE_REQUEST_INTERVAL_MS, so this only lets
// slow free-model calls overlap; the request rate is unchanged.
const ROUTE_CONCURRENCY = EVAL_DEFAULT_CONCURRENCY;

/**
 * Cached reads (src/lib/data) hold COMPLETED evaluations only, so only a completed run changes
 * them. A failed/cut-short run is never published and needs no invalidation.
 */
function revalidateIfPublished(output: EvaluationRunOutput | null): void {
  if (output?.status === "completed") revalidateEvaluations();
}

function runErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof EvaluationRunError) {
    switch (err.code) {
      case "MODEL_NOT_FOUND":
      case "BENCHMARK_NOT_FOUND":
      case "NO_QUESTIONS":
        return apiError(err.message, "NOT_FOUND", 404);
      case "MODEL_NOT_FREE":
        return apiError(err.message, "MODEL_NOT_FREE", 400);
      case "SELF_JUDGED":
        return apiError(err.message, "SELF_JUDGED", 400);
      default:
        return apiError(err.message, "DATABASE_ERROR", 500);
    }
  }
  if (err instanceof AdminConfigError) return apiError(err.message, "CONFIG_ERROR", 500);
  return apiError(errorMessage(err, "Failed to execute evaluation."), "INTERNAL_ERROR", 500);
}

/**
 * POST /api/evaluations/run — { modelId, benchmarkId, limitQuestions?, stream? }
 * Streams progress as Server-Sent Events by default. Live runs are restricted to `:free` models,
 * bounded by the 270 s run budget (EVAL_RUN_BUDGET_MS), and run the benchmark's imported
 * questions only (see runEvaluation). Scorers may be async (LLM judge, code execution); the
 * runner awaits and bounds them. A daily-quota stop finalizes the row as failed. Up to
 * ROUTE_CONCURRENCY prompts run at once, so `question_complete` events can arrive out of order
 * (each carries its question `index`). A completed run revalidates the cached evaluation reads.
 */
export async function POST(req: NextRequest) {
  // The budget clock starts at request entry: pre-flight time counts against maxDuration too.
  const deadlineAt = Date.now() + EVAL_RUN_BUDGET_MS;

  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  // Per-IP, per-instance sliding window (see lib/api/rate-limit.ts).
  const limited = enforceRateLimit(req, "evaluationRun");
  if (limited) return limited;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const { modelId, benchmarkId, limitQuestions, stream = true } = parsed.body;

  if (!isUuid(modelId) || !isUuid(benchmarkId)) {
    return apiError("modelId and benchmarkId must be valid UUIDs.", "VALIDATION_ERROR", 400);
  }
  if (typeof stream !== "boolean") {
    return apiError("stream must be a boolean.", "VALIDATION_ERROR", 400);
  }

  let questionCount = DEFAULT_QUESTIONS;
  if (limitQuestions !== undefined && limitQuestions !== null) {
    const n = Number(limitQuestions);
    if (!Number.isInteger(n) || n < 1 || n > MAX_QUESTIONS) {
      return apiError(`limitQuestions must be an integer between 1 and ${MAX_QUESTIONS}.`, "VALIDATION_ERROR", 400);
    }
    questionCount = n;
  }

  // Pre-flight with the RLS-scoped client so bad input gets a proper status instead of a stream error.
  try {
    const supabase = await createRouteHandlerClient();
    const [{ data: model, error: modelError }, { data: benchmark, error: benchmarkError }] = await Promise.all([
      supabase.from("models").select("id, api_identifier").eq("id", modelId).maybeSingle(),
      supabase.from("benchmarks").select("id").eq("id", benchmarkId).maybeSingle(),
    ]);

    if (modelError) return databaseErrorResponse(modelError, "Failed to load model");
    if (benchmarkError) return databaseErrorResponse(benchmarkError, "Failed to load benchmark");
    if (!model) return apiError("Model not found.", "NOT_FOUND", 404);
    if (!benchmark) return apiError("Benchmark not found.", "NOT_FOUND", 404);

    const apiIdentifier = (model as { api_identifier: string }).api_identifier;
    if (!isFreeModelId(apiIdentifier)) {
      return apiError(
        `Live evaluations are limited to free-tier OpenRouter models (":free"). "${apiIdentifier}" is a paid model.`,
        "MODEL_NOT_FREE",
        400
      );
    }
  } catch (err) {
    console.error("Evaluation pre-flight error:", err);
    return apiError(errorMessage(err, "Failed to validate evaluation request."), "INTERNAL_ERROR", 500);
  }

  if (!stream) {
    try {
      const result = await runEvaluation({
        modelId,
        benchmarkId,
        limitQuestions: questionCount,
        deadlineAt,
        minRequestIntervalMs: ROUTE_REQUEST_INTERVAL_MS,
        concurrency: ROUTE_CONCURRENCY,
      });
      // Called before the Response is returned, so Next flushes it with this request.
      revalidateIfPublished(result);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      console.error("Evaluation run error:", err);
      return runErrorResponse(err);
    }
  }

  // Server-Sent Events. If the client disconnects, the run still finishes and is persisted —
  // enqueue failures are swallowed so the evaluation record never gets stuck in "running".
  //
  // Cache invalidation must go through after(): Next flushes revalidateTag() calls made during
  // a Route Handler only when the handler returns its Response, which here is before the run
  // even starts. after() callbacks run once the response closes (or the client disconnects) and
  // their revalidations are flushed; the callback waits for the run itself to settle.
  let settleRun: (output: EvaluationRunOutput | null) => void = () => {};
  const runSettled = new Promise<EvaluationRunOutput | null>((resolve) => {
    settleRun = resolve;
  });
  after(async () => {
    revalidateIfPublished(await runSettled);
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: EvaluationProgressEvent | { type: "error"; message: string; code: string }) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      try {
        const output = await runEvaluation({
          modelId,
          benchmarkId,
          limitQuestions: questionCount,
          deadlineAt,
          minRequestIntervalMs: ROUTE_REQUEST_INTERVAL_MS,
          concurrency: ROUTE_CONCURRENCY,
          onProgress: send,
        });
        settleRun(output);
      } catch (err) {
        console.error("Evaluation run error:", err);
        send({
          type: "error",
          message: errorMessage(err, "Execution failed"),
          code: err instanceof EvaluationRunError ? err.code : "INTERNAL_ERROR",
        });
      } finally {
        settleRun(null); // no-op when the run already settled with its output
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // Stream already closed by the client.
          }
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
