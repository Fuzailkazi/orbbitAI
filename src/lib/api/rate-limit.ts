import type { NextResponse } from "next/server";
import { apiError, type ApiErrorBody } from "./responses";

/**
 * Sliding-window-log rate limiter, keyed by client IP.
 *
 * PER-INSTANCE ONLY: state lives in this server process's memory, so each serverless
 * instance (and each dev-server restart) keeps its own counters. It blunts casual abuse of
 * the expensive guest-reachable routes; it is not a distributed quota. Move it to a shared
 * store (e.g. Redis/Upstash or a Supabase table) if a hard global limit is ever required.
 */
export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** ms until the oldest hit in the window expires (0 when allowed). */
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  reset(): void;
  /** Number of keys currently tracked (for tests / memory checks). */
  size(): number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys before a full sweep of expired entries (memory guard). */
  maxKeys?: number;
}

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: RateLimiterOptions): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("windowMs must be positive");

  const hits = new Map<string, number[]>();

  function sweep(now: number) {
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1] <= now - windowMs) hits.delete(key);
    }
    // Hard cap: if every tracked key is still active (e.g. a flood of spoofed IPs), evict the
    // oldest-inserted keys (Map iteration order) so memory stays bounded at maxKeys and the
    // next sweep isn't O(n) on every request. Evict a 10% slice to amortise the sweep cost.
    if (hits.size >= maxKeys) {
      let toEvict = hits.size - maxKeys + Math.max(1, Math.floor(maxKeys / 10));
      for (const key of hits.keys()) {
        if (toEvict-- <= 0) break;
        hits.delete(key);
      }
    }
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      if (hits.size >= maxKeys && !hits.has(key)) sweep(now);

      const windowStart = now - windowMs;
      const times = (hits.get(key) ?? []).filter((t) => t > windowStart);

      if (times.length >= limit) {
        hits.set(key, times);
        return { ok: false, limit, remaining: 0, retryAfterMs: Math.max(0, times[0] + windowMs - now) };
      }

      times.push(now);
      hits.set(key, times);
      return { ok: true, limit, remaining: limit - times.length, retryAfterMs: 0 };
    },
    reset() {
      hits.clear();
    },
    size() {
      return hits.size;
    },
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitedResponse(result: RateLimitResult, action: string): NextResponse<ApiErrorBody> {
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  const response = apiError(
    `Too many ${action} requests. Try again in ${seconds}s.`,
    "RATE_LIMITED",
    429
  );
  response.headers.set("Retry-After", String(seconds));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", "0");
  return response;
}

/**
 * Shared per-route limiters. Module scope → one set per server instance (see note above).
 * Budgets are sized for a human clicking around the demo, not for scripted traffic.
 */
const TEN_MINUTES = 10 * 60 * 1000;

export const rateLimiters = {
  modelSync: createRateLimiter({ limit: 3, windowMs: TEN_MINUTES }),
  evaluationRun: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES }),
  customBenchmark: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES }),
} as const;

export type RateLimitedRoute = keyof typeof rateLimiters;

const ACTION_LABELS: Record<RateLimitedRoute, string> = {
  modelSync: "model sync",
  evaluationRun: "evaluation",
  customBenchmark: "benchmark upload",
};

/** Returns a 429 response when the caller is over budget for `route`, otherwise null. */
export function enforceRateLimit(req: Request, route: RateLimitedRoute): NextResponse<ApiErrorBody> | null {
  const result = rateLimiters[route].check(clientIp(req.headers));
  return result.ok ? null : rateLimitedResponse(result, ACTION_LABELS[route]);
}
