/**
 * Wall-clock budget for a live evaluation run.
 *
 * /api/evaluations/run executes the whole run inside one request whose platform limit is
 * `maxDuration` (seconds). Next.js requires that export to be a literal, so the route
 * declares `export const maxDuration = 300` and this constant MUST match it.
 */
export const EVAL_MAX_DURATION_MS = 300_000;

/** Reserved at the end of the budget for finalizing the evaluation row and closing the stream. */
export const EVAL_FINALIZE_MARGIN_MS = 30_000;

/** The runner stops starting new prompts once this much wall-clock time has elapsed. */
export const EVAL_RUN_BUDGET_MS = EVAL_MAX_DURATION_MS - EVAL_FINALIZE_MARGIN_MS;

/** A prompt is only started if at least this much budget remains (keeps timeouts meaningful). */
export const EVAL_MIN_PROMPT_BUDGET_MS = 15_000;

/** Upper bound for a single model call (also clamped to the remaining budget). */
export const EVAL_MAX_CALL_TIMEOUT_MS = 90_000;

/**
 * A row still `running` this long after `started_at` cannot belong to a live request — the
 * function was killed (timeout, crash, deploy, dev-server restart) before it could finalize.
 */
export const EVAL_STALL_THRESHOLD_MS = EVAL_MAX_DURATION_MS + 60_000;

/** Scoring (LLM judge call, sandboxed code execution) is bounded so a hung scorer can't stall a run. */
export const EVAL_MAX_SCORING_MS = 120_000;

/**
 * Floor for the scoring budget near the run deadline: the pass@1 sandbox needs up to 5 s plus
 * worker start-up and a judge call needs a network round trip. Well inside
 * EVAL_FINALIZE_MARGIN_MS, so the route still finalizes before maxDuration.
 */
export const EVAL_MIN_SCORING_MS = 10_000;

/**
 * Default completion budget per prompt. Chain-of-thought formats (GSM8K, MATH) and code need
 * room to finish; a reply cut off at the limit is graded as-is (it is the model's answer).
 */
export const EVAL_DEFAULT_MAX_TOKENS = 2048;

/**
 * After a per-minute 429 the runner pauses before starting the NEXT prompt (the failed prompt
 * is recorded, never retried — rule 9). Bounded so a run always makes progress well inside
 * EVAL_STALL_THRESHOLD_MS between per-prompt inserts.
 */
export const EVAL_RATE_LIMIT_PAUSE_MS = 60_000;

/**
 * A no-deadline (batch) run is only live while it keeps inserting per-prompt rows. The gap
 * between two inserts is bounded by pacing + call timeout + scoring timeout + rate-limit
 * pause, all far below EVAL_STALL_THRESHOLD_MS, so "no result row within the threshold"
 * reliably means the process died.
 */
export const EVAL_ACTIVITY_WINDOW_MS = EVAL_STALL_THRESHOLD_MS;

/**
 * Prompts kept in flight at once by the runner (API route and batch CLI). Request STARTS are
 * still spaced by the shared RequestPacer, so this never raises the request rate: it only lets
 * a slow free-model call (5–30 s) overlap the next paced start instead of blocking it. Each
 * in-flight call keeps its own timeout, so the deadline/finalize margins above still hold.
 */
export const EVAL_DEFAULT_CONCURRENCY = 3;

/** Upper bound for the concurrency option (more would only queue behind the pacer anyway). */
export const EVAL_MAX_CONCURRENCY = 5;
