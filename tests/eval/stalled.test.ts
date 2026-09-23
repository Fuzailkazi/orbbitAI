import test from "node:test";
import assert from "node:assert/strict";
import { EVAL_RUN_BUDGET_MS, EVAL_STALL_THRESHOLD_MS, EVAL_MAX_DURATION_MS } from "../../src/lib/eval/limits";
import { isStalledEvaluation, isStalledRunning, wasReapedAsStalled } from "../../src/lib/eval/stalled";

const T0 = Date.UTC(2026, 0, 1);
const iso = (ms: number) => new Date(ms).toISOString();

test("limits: the run budget leaves room to finalize inside maxDuration; stall threshold exceeds it", () => {
  assert.ok(EVAL_RUN_BUDGET_MS < EVAL_MAX_DURATION_MS);
  assert.ok(EVAL_STALL_THRESHOLD_MS > EVAL_MAX_DURATION_MS);
});

test("isStalledRunning: only running rows older than the threshold", () => {
  const base = { status: "running" as const, started_at: iso(T0), created_at: iso(T0) };
  assert.equal(isStalledRunning(base, T0 + EVAL_STALL_THRESHOLD_MS - 1), false);
  assert.equal(isStalledRunning(base, T0 + EVAL_STALL_THRESHOLD_MS + 1), true);
  assert.equal(isStalledRunning({ ...base, status: "completed" }, T0 + 10 * EVAL_STALL_THRESHOLD_MS), false);
  // Falls back to created_at when started_at is missing.
  assert.equal(isStalledRunning({ ...base, started_at: null }, T0 + EVAL_STALL_THRESHOLD_MS + 1), true);
});

test("wasReapedAsStalled: failed, no accuracy, closed past the threshold", () => {
  const reaped = {
    status: "failed" as const,
    started_at: iso(T0),
    created_at: iso(T0),
    completed_at: iso(T0 + EVAL_STALL_THRESHOLD_MS + 5_000),
    accuracy: null,
  };
  assert.equal(wasReapedAsStalled(reaped), true);
  // The runner's own failures finalize within its budget → plain "failed".
  assert.equal(wasReapedAsStalled({ ...reaped, completed_at: iso(T0 + EVAL_RUN_BUDGET_MS) }), false);
  assert.equal(wasReapedAsStalled({ ...reaped, accuracy: 42 }), false);
  assert.equal(wasReapedAsStalled({ ...reaped, status: "completed" }), false);
  assert.equal(isStalledEvaluation(reaped, T0), true);
});
