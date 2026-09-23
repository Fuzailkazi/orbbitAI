/**
 * Local day-bucket request ledger for the batch CLI (scripts/.batch-state.json).
 *
 * OpenRouter's free-model daily counter resets at 00:00 UTC, so requests are bucketed by UTC
 * day. The ledger lets `--daily-cap` hold across restarts; the key endpoint
 * (free_model_daily_requests) remains the authoritative account-wide counter when reachable.
 */

export interface BatchDayBucket {
  requests: number;
}

export interface BatchState {
  version: 1;
  days: Record<string, BatchDayBucket>;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const KEEP_DAYS = 14;

export function emptyBatchState(): BatchState {
  return { version: 1, days: {} };
}

/** "YYYY-MM-DD" of the UTC day containing `ms`. */
export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Milliseconds until the next 00:00 UTC. */
export function msUntilUtcMidnight(ms: number): number {
  const d = new Date(ms);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - ms;
}

/** Validates a parsed JSON value; anything malformed yields an empty ledger (never throws). */
export function parseBatchState(value: unknown): BatchState {
  if (typeof value !== "object" || value === null) return emptyBatchState();
  const days = (value as { days?: unknown }).days;
  if (typeof days !== "object" || days === null) return emptyBatchState();
  const out: Record<string, BatchDayBucket> = {};
  for (const [key, bucket] of Object.entries(days as Record<string, unknown>)) {
    if (!DAY_KEY.test(key) || typeof bucket !== "object" || bucket === null) continue;
    const requests = (bucket as { requests?: unknown }).requests;
    if (typeof requests === "number" && Number.isFinite(requests) && requests >= 0) {
      out[key] = { requests: Math.floor(requests) };
    }
  }
  return { version: 1, days: out };
}

export function requestsUsedOn(state: BatchState, day: string): number {
  return state.days[day]?.requests ?? 0;
}

/** Returns a new ledger with `count` requests added to `day`, pruned to the last KEEP_DAYS days. */
export function addRequests(state: BatchState, day: string, count: number): BatchState {
  const add = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const days: Record<string, BatchDayBucket> = { ...state.days, [day]: { requests: requestsUsedOn(state, day) + add } };
  const kept = Object.keys(days).sort().slice(-KEEP_DAYS);
  return { version: 1, days: Object.fromEntries(kept.map((k) => [k, days[k]])) };
}
