/**
 * Classification of OpenRouter failures.
 *
 * Free-tier limits (https://openrouter.ai/docs/api-reference/limits, checked 2026-09-23):
 *   - `:free` models: 20 requests/minute for every account.
 *   - Daily: 50 requests/day if the account has purchased < 10 credits, 1000/day otherwise.
 *     The daily counter resets at 00:00 UTC and is reported by GET /api/v1/key as
 *     `free_model_daily_requests: { used, limit, remaining }`.
 *   - A hit limit returns HTTP 429. The message names the bucket:
 *     "Rate limit exceeded: free-models-per-min" / "free-models-per-day" /
 *     "free-models-per-day-high-balance". Platform 429s also carry X-RateLimit-Limit /
 *     -Remaining / -Reset (epoch ms) headers.
 *   - An unavailable free variant returns 404, e.g. "This model is unavailable for free…" or
 *     "No endpoints found for <slug>".
 *
 * The kind decides what the caller does next — it never triggers a retry of the same prompt
 * (rule 9: failures are recorded, not retried silently):
 *   - rate_limited_minute    → record the failure, pause before the next prompt.
 *   - daily_quota_exhausted  → record the failure, stop starting prompts, stop the batch.
 *   - insufficient_credits   → same as daily quota (402: nothing else will succeed today).
 *   - auth                   → same (every further call would fail identically).
 *   - model_unavailable      → record; the model is gone from the free tier.
 *   - timeout | network | aborted | other → record and continue.
 */
export type OpenRouterErrorKind =
  | "rate_limited_minute"
  | "daily_quota_exhausted"
  | "insufficient_credits"
  | "model_unavailable"
  | "auth"
  | "timeout"
  | "network"
  | "aborted"
  | "other";

export interface OpenRouterErrorClassification {
  kind: OpenRouterErrorKind;
  /** Suggested pause before the NEXT request (never a retry of this one), when known. */
  retryAfterMs: number | null;
}

/** Minimal header accessor so tests can pass a plain object. */
export interface HeaderReader {
  get(name: string): string | null;
}

/** A 429 whose reset is further away than this is a daily bucket, not the per-minute one. */
const DAILY_RESET_THRESHOLD_MS = 10 * 60_000;

const DAILY_PATTERN = /free-models-per-day|per[-\s]?day|daily (limit|quota)|requests per day/i;
const MINUTE_PATTERN = /free-models-per-min|per[-\s]?min(ute)?/i;
const UNAVAILABLE_PATTERN =
  /no endpoints found|unavailable for free|model (is )?(not found|unavailable|deprecated|no longer available)|not a valid model id|is not available/i;
const CREDITS_PATTERN = /insufficient credits|requires more credits|payment required|negative balance/i;

function parseNumberHeader(headers: HeaderReader | undefined, name: string): number | null {
  const raw = headers?.get(name);
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** X-RateLimit-Reset is epoch milliseconds on OpenRouter; tolerate epoch seconds too. */
function resetDelayMs(headers: HeaderReader | undefined, now: number): number | null {
  const reset = parseNumberHeader(headers, "x-ratelimit-reset");
  if (reset !== null) {
    const resetMs = reset < 1e12 ? reset * 1000 : reset;
    return Math.max(0, resetMs - now);
  }
  const retryAfter = parseNumberHeader(headers, "retry-after");
  return retryAfter !== null ? Math.max(0, retryAfter * 1000) : null;
}

export function classifyOpenRouterFailure(
  status: number | null,
  message: string,
  headers?: HeaderReader,
  now: number = Date.now()
): OpenRouterErrorClassification {
  const delay = resetDelayMs(headers, now);

  if (status === 429 || /rate limit exceeded/i.test(message)) {
    if (DAILY_PATTERN.test(message)) return { kind: "daily_quota_exhausted", retryAfterMs: delay };
    if (MINUTE_PATTERN.test(message)) return { kind: "rate_limited_minute", retryAfterMs: delay };
    const remaining = parseNumberHeader(headers, "x-ratelimit-remaining");
    if (remaining === 0 && delay !== null && delay > DAILY_RESET_THRESHOLD_MS) {
      return { kind: "daily_quota_exhausted", retryAfterMs: delay };
    }
    // Upstream provider throttling ("temporarily rate-limited upstream") is transient too.
    return { kind: "rate_limited_minute", retryAfterMs: delay };
  }
  if (status === 402 || CREDITS_PATTERN.test(message)) return { kind: "insufficient_credits", retryAfterMs: null };
  if (status === 401 || status === 403) return { kind: "auth", retryAfterMs: null };
  if (status === 404 || UNAVAILABLE_PATTERN.test(message)) return { kind: "model_unavailable", retryAfterMs: null };
  return { kind: "other", retryAfterMs: null };
}

/** Kinds after which no further request can succeed today — the batch must stop. */
export function isQuotaStop(kind: OpenRouterErrorKind): boolean {
  return kind === "daily_quota_exhausted" || kind === "insufficient_credits" || kind === "auth";
}
