import type { ScoringResult } from "../types";

/**
 * Result for a question the scorer could not grade (judge unavailable, sandbox failed to
 * start, question metadata missing). This is NOT a model miss: the runner stores the row,
 * excludes it from the accuracy denominator and counts it in failure_rate.
 */
export function unscoredResult(reasoning: string, extra: Record<string, unknown> = {}): ScoringResult {
  return {
    isCorrect: false,
    score: 0,
    reasoning,
    metadata: { ...extra, unscored: true },
  };
}

/** True when a scorer declined to produce a verdict (see `unscoredResult`). */
export function isUnscoredResult(result: Pick<ScoringResult, "metadata">): boolean {
  return result.metadata?.unscored === true;
}
