import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWilsonConfidenceInterval,
  calculatePercentile,
  calculateTokensPerSecond,
} from "../../src/lib/eval/statistics";

test("calculateWilsonConfidenceInterval: 0 correct out of 100", () => {
  const ci = calculateWilsonConfidenceInterval(0, 100);
  assert.equal(ci.lower, 0);
  assert.ok(ci.upper > 0 && ci.upper < 5, `Expected upper bound between 0 and 5%, got ${ci.upper}`);
});

test("calculateWilsonConfidenceInterval: 100 correct out of 100", () => {
  const ci = calculateWilsonConfidenceInterval(100, 100);
  assert.ok(ci.lower > 95 && ci.lower < 100, `Expected lower bound between 95 and 100%, got ${ci.lower}`);
  assert.equal(ci.upper, 100);
});

test("calculateWilsonConfidenceInterval: 50 correct out of 100", () => {
  const ci = calculateWilsonConfidenceInterval(50, 100);
  assert.ok(ci.lower >= 40 && ci.lower <= 41, `Expected lower ~ 40%, got ${ci.lower}`);
  assert.ok(ci.upper >= 59 && ci.upper <= 61, `Expected upper ~ 60%, got ${ci.upper}`);
});

test("calculateWilsonConfidenceInterval: edge case total <= 0", () => {
  const ci = calculateWilsonConfidenceInterval(0, 0);
  assert.deepEqual(ci, { lower: 0, upper: 0 });
});

test("calculatePercentile: computes median (P50) correctly", () => {
  const values = [100, 200, 300, 400, 500];
  const p50 = calculatePercentile(values, 50);
  assert.equal(p50, 300);
});

test("calculatePercentile: computes P95 on arbitrary distribution", () => {
  const values = [50, 120, 130, 140, 150, 160, 170, 180, 190, 800];
  const p95 = calculatePercentile(values, 95);
  assert.ok(p95 > 200, `Expected P95 to be affected by high tail, got ${p95}`);
});

test("calculatePercentile: handles empty array", () => {
  assert.equal(calculatePercentile([], 50), 0);
});

test("calculateTokensPerSecond: accurate throughput", () => {
  // 150 tokens in 1500 ms = 100 tokens/sec
  const tps = calculateTokensPerSecond(150, 1500);
  assert.equal(tps, 100);
});

test("calculateTokensPerSecond: handles zero duration safely", () => {
  assert.equal(calculateTokensPerSecond(150, 0), 0);
});
