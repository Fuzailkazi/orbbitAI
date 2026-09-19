/**
 * Statistical utilities for AI evaluations:
 * - Wilson score confidence intervals
 * - Percentiles (P50, P90, P95)
 * - Throughput (TPS)
 */

export interface ConfidenceInterval {
  lower: number; // percentage (0 - 100)
  upper: number; // percentage (0 - 100)
}

/**
 * Calculates the Wilson score 95% confidence interval for a binomial proportion.
 * @param correct Number of successes
 * @param total Total number of trials
 * @param z Standard normal quantile (defaults to 1.96 for 95% CI)
 */
export function calculateWilsonConfidenceInterval(
  correct: number,
  total: number,
  z: number = 1.96
): ConfidenceInterval {
  if (total <= 0) {
    return { lower: 0, upper: 0 };
  }

  const p = correct / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);

  const lower = Math.max(0, (center - spread) / denominator) * 100;
  const upper = Math.min(1, (center + spread) / denominator) * 100;

  return {
    lower: Math.round(lower * 10) / 10,
    upper: Math.round(upper * 10) / 10,
  };
}

/**
 * Computes a specific percentile from an array of numbers.
 * @param values Array of numbers (e.g. latencies)
 * @param p Percentile between 0 and 100 (e.g. 50, 90, 95)
 */
export function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

/**
 * Calculates average tokens per second across prompt outputs.
 */
export function calculateTokensPerSecond(
  completionTokens: number,
  totalLatencyMs: number
): number {
  if (totalLatencyMs <= 0) return 0;
  const seconds = totalLatencyMs / 1000;
  return Math.round((completionTokens / seconds) * 10) / 10;
}
