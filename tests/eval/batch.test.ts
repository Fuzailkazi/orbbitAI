import test from "node:test";
import assert from "node:assert/strict";
import { BatchArgsError, parseBatchArgs, BATCH_DEFAULTS } from "../../src/lib/eval/batch/args";
import { RequestPacer, intervalForRpm, pacingDelayMs, type PacerClock } from "../../src/lib/eval/batch/pacing";
import {
  KEY_SAFETY_RESERVE,
  effectiveDailyCapacity,
  estimateDays,
  fitPairsToBudget,
  planBatch,
  remainingDailyBudget,
  requestsPerQuestion,
  selectRunnableBenchmarks,
  type PlanBenchmark,
  type PlanModel,
} from "../../src/lib/eval/batch/planning";
import {
  addRequests,
  emptyBatchState,
  msUntilUtcMidnight,
  parseBatchState,
  requestsUsedOn,
  utcDayKey,
} from "../../src/lib/eval/batch/state";
import {
  isAutoCandidate,
  parseParamsBillions,
  rankAutoCandidates,
  type CandidateModel,
} from "../../src/lib/eval/batch/models";
import { aggregateRun, orderQuestionsBySample } from "../../src/lib/eval/runner";
import { EVAL_ACTIVITY_WINDOW_MS, EVAL_STALL_THRESHOLD_MS } from "../../src/lib/eval/limits";
import { isStalledRunning, wasReapedAsStalled } from "../../src/lib/eval/stalled";

// ---------- args ----------

test("parseBatchArgs: defaults and every flag", () => {
  const d = parseBatchArgs([]);
  assert.ok(d);
  assert.equal(d.models, "auto");
  assert.equal(d.benchmarks, "runnable");
  assert.equal(d.n, BATCH_DEFAULTS.n);
  assert.equal(d.rpm, 16);
  assert.equal(d.dailyCap, 900);
  assert.equal(d.dryRun, false);
  assert.equal(d.maxEvals, null);

  const a = parseBatchArgs([
    "--models", "a:free,b:free", "--benchmarks=MMLU,GSM8K", "--n", "50", "--rpm", "10",
    "--daily-cap", "40", "--dry-run", "--max-evals", "3", "--max-tokens", "512",
  ]);
  assert.ok(a);
  assert.deepEqual(a.models, ["a:free", "b:free"]);
  assert.deepEqual(a.benchmarks, ["MMLU", "GSM8K"]);
  assert.equal(a.n, 50);
  assert.equal(a.rpm, 10);
  assert.equal(a.dailyCap, 40);
  assert.equal(a.dryRun, true);
  assert.equal(a.maxEvals, 3);
  assert.equal(a.maxTokens, 512);
  assert.equal(parseBatchArgs(["--help"]), null);
});

test("parseBatchArgs: rejects bad values and unknown flags", () => {
  assert.throws(() => parseBatchArgs(["--rpm", "25"]), BatchArgsError); // above the 20 RPM free limit
  assert.throws(() => parseBatchArgs(["--rpm", "2"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--n", "0"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--n", "1.5"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--n"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--models", "--dry-run"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--wat"]), BatchArgsError);
});

// ---------- pacing ----------

function fakeClock(start = 0): PacerClock & { t: number; slept: number[] } {
  const clock = {
    t: start,
    slept: [] as number[],
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.slept.push(ms);
      clock.t += ms;
    },
  };
  return clock;
}

test("intervalForRpm / pacingDelayMs", () => {
  assert.equal(intervalForRpm(16), 3750);
  assert.equal(intervalForRpm(20), 3000);
  assert.throws(() => intervalForRpm(0));
  assert.equal(pacingDelayMs(5000, 3000), 2000);
  assert.equal(pacingDelayMs(1000, 3000), 0);
});

test("RequestPacer: spaces request starts, reserves multiple units, honours pauses", async () => {
  const clock = fakeClock(10_000);
  const pacer = new RequestPacer(1000, clock);
  assert.equal(await pacer.acquire(), 0); // first request starts immediately
  clock.t += 200; // the request took 200ms
  assert.equal(await pacer.acquire(), 800); // waits out the rest of the interval
  assert.equal(await pacer.acquire(2), 1000); // judge benchmark: reserves 2 slots
  assert.equal(await pacer.acquire(), 2000);
  pacer.pause(60_000);
  assert.equal(pacer.pendingDelayMs(), 60_000);
  pacer.pause(10); // a shorter pause never shortens an existing one
  assert.equal(pacer.pendingDelayMs(), 60_000);
});

test("RequestPacer: an aborted signal ends the wait without reserving", async () => {
  const pacer = new RequestPacer(60_000);
  await pacer.acquire();
  const ctrl = new AbortController();
  ctrl.abort();
  const started = Date.now();
  await pacer.acquire(1, ctrl.signal);
  assert.ok(Date.now() - started < 1000);
});

// ---------- day-bucket state ----------

test("state: UTC day keys, accumulation, pruning, malformed input", () => {
  const t = Date.UTC(2026, 8, 23, 23, 59, 0);
  assert.equal(utcDayKey(t), "2026-09-23");
  assert.equal(utcDayKey(t + 60_000), "2026-09-24");
  assert.equal(msUntilUtcMidnight(t), 60_000);

  let s = emptyBatchState();
  s = addRequests(s, "2026-09-23", 10);
  s = addRequests(s, "2026-09-23", 5);
  s = addRequests(s, "2026-09-24", 1);
  s = addRequests(s, "2026-09-24", -3); // ignored
  assert.equal(requestsUsedOn(s, "2026-09-23"), 15);
  assert.equal(requestsUsedOn(s, "2026-09-24"), 1);
  assert.equal(requestsUsedOn(s, "2026-09-25"), 0);

  for (let d = 1; d <= 20; d++) s = addRequests(s, `2026-10-${String(d).padStart(2, "0")}`, 1);
  assert.equal(Object.keys(s.days).length, 14);
  assert.equal(requestsUsedOn(s, "2026-09-23"), 0); // pruned

  assert.deepEqual(parseBatchState(null), emptyBatchState());
  assert.deepEqual(parseBatchState({ days: { "bad-key": { requests: 3 }, "2026-01-01": { requests: "x" } } }).days, {});
  assert.equal(requestsUsedOn(parseBatchState({ days: { "2026-01-01": { requests: 7 } } }), "2026-01-01"), 7);
});

// ---------- planning ----------

const M1: PlanModel = { id: "m1", name: "Model 1", api_identifier: "a/one:free" };
const M2: PlanModel = { id: "m2", name: "Model 2", api_identifier: "b/two:free" };
const bench = (id: string, name: string, method: string, hf: number): PlanBenchmark => ({
  id,
  name,
  scoring_method: method,
  hfQuestions: hf,
});

test("requestsPerQuestion: judge benchmarks cost a second request", () => {
  assert.equal(requestsPerQuestion("exact_match"), 1);
  assert.equal(requestsPerQuestion("pass_at_k"), 1);
  assert.equal(requestsPerQuestion("llm_judge"), 2);
});

test("selectRunnableBenchmarks: needs imported questions (min 20) and a registered scorer", () => {
  const supported = (m: string) => m !== "bleu";
  const { runnable, skipped } = selectRunnableBenchmarks(
    [
      bench("b1", "MMLU", "exact_match", 500),
      bench("b2", "IFEval", "exact_match", 0),
      bench("b3", "Tiny", "exact_match", 12),
      bench("b4", "MT-Bench", "llm_judge", 80),
      bench("b5", "Bleu", "bleu", 100),
    ],
    { n: 100, isSupportedMethod: supported }
  );
  assert.deepEqual(runnable.map((b) => b.name), ["MMLU", "MT-Bench"]);
  assert.deepEqual(skipped.map((s) => s.benchmark.name), ["IFEval", "Tiny", "Bleu"]);
  assert.match(skipped[0].reason, /not yet runnable/);
  // With a small n, a benchmark with fewer than 20 questions but ≥ n is runnable.
  assert.equal(selectRunnableBenchmarks([bench("b3", "Tiny", "exact_match", 12)], { n: 10, isSupportedMethod: supported }).runnable.length, 1);
});

test("planBatch: cheap benchmarks first, resumable skip, n capped by imported questions", () => {
  const benchmarks = [bench("bj", "MT-Bench", "llm_judge", 80), bench("bm", "MMLU", "exact_match", 500)];
  const plan = planBatch(
    [M1, M2],
    benchmarks,
    [
      { model_id: "m1", benchmark_id: "bm", questions_evaluated: 100 }, // done
      { model_id: "m2", benchmark_id: "bm", questions_evaluated: 25 }, // too small → rerun
    ],
    100
  );
  assert.deepEqual(
    plan.pairs.map((p) => `${p.benchmark.name}/${p.model.id}/${p.questions}/${p.estimatedRequests}`),
    ["MMLU/m2/100/100", "MT-Bench/m1/80/160", "MT-Bench/m2/80/160"]
  );
  assert.equal(plan.skippedPairs.length, 1);
  assert.equal(plan.totalRequests, 420);
});

test("daily budget: local cap, key counter and safety reserve", () => {
  assert.equal(remainingDailyBudget({ dailyCap: 900, localUsedToday: 100, key: null }), 800);
  // The key's account-wide counter wins when it is tighter (free tier: 50/day).
  assert.equal(
    remainingDailyBudget({ dailyCap: 900, localUsedToday: 0, key: { limit: 50, remaining: 43 } }),
    43 - KEY_SAFETY_RESERVE
  );
  assert.equal(remainingDailyBudget({ dailyCap: 10, localUsedToday: 12, key: { limit: 1000, remaining: 900 } }), 0);
  assert.equal(effectiveDailyCapacity({ dailyCap: 900, key: { limit: 50, remaining: 1 } }), 50 - KEY_SAFETY_RESERVE);
  assert.equal(effectiveDailyCapacity({ dailyCap: 900, key: { limit: 1000, remaining: 1 } }), 900);
  assert.equal(effectiveDailyCapacity({ dailyCap: 900, key: null }), 900);
});

test("estimateDays / fitPairsToBudget: stop before a pair that would exceed the budget", () => {
  assert.equal(estimateDays(0, 900), 0);
  assert.equal(estimateDays(1800, 900), 2);
  assert.equal(estimateDays(1801, 900), 3);
  assert.equal(estimateDays(10, 0), Number.POSITIVE_INFINITY);

  const plan = planBatch([M1, M2], [bench("bm", "MMLU", "exact_match", 500), bench("bj", "MT", "llm_judge", 80)], [], 100);
  const fit = fitPairsToBudget(plan.pairs, 250, null);
  assert.equal(fit.runnable.length, 2);
  assert.equal(fit.usedRequests, 200);
  assert.equal(fit.blockedBy?.benchmark.name, "MT");
  assert.equal(fitPairsToBudget(plan.pairs, 10_000, 1).runnable.length, 1);
  assert.equal(fitPairsToBudget(plan.pairs, 10_000, null).blockedBy, null);
});

// ---------- auto model ranking ----------

const cand = (api: string, extra: Partial<CandidateModel> = {}): CandidateModel => ({
  id: api,
  name: api,
  vendor: api.split("/")[0],
  api_identifier: api,
  is_active: true,
  category: "chat",
  context_window: 131072,
  release_date: null,
  ...extra,
});

test("parseParamsBillions: total parameters, ignoring active-parameter suffixes", () => {
  assert.equal(parseParamsBillions("nvidia/nemotron-3-super-120b-a12b:free"), 120);
  assert.equal(parseParamsBillions("meta-llama/llama-3.3-70b-instruct:free"), 70);
  assert.equal(parseParamsBillions("liquid/lfm-2.5-2.6b:free"), 2.6);
  assert.equal(parseParamsBillions("z-ai/glm-5.2:free"), null);
});

test("rankAutoCandidates: free/active text models, one per vendor first, bigger first", () => {
  const ranked = rankAutoCandidates([
    cand("google/gemma-3-4b-it:free"),
    cand("google/gemma-3-27b-it:free"),
    cand("meta-llama/llama-3.3-70b-instruct:free"),
    cand("liquid/lfm-2.5-2.6b:free"), // too small
    cand("nvidia/nemotron-3.5-content-safety:free"), // classifier
    cand("openai/gpt-4o"), // not free
    cand("qwen/qwen-2.5-72b-instruct:free", { is_active: false }),
    cand("meta-llama/llama-3.2-11b-vision-instruct:free", { category: "vision" }),
  ]);
  // gemma-3-4b (< 7B) and the rest are filtered; Meta and Google each get their best model.
  assert.deepEqual(
    ranked.map((m) => m.api_identifier),
    ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"]
  );
  assert.equal(isAutoCandidate(cand("google/gemma-3-4b-it:free")), false);
});

// ---------- runner metric definitions ----------

test("aggregateRun: accuracy and CI over scored prompts; failures and unscored in failure rate", () => {
  const agg = aggregateRun({ attempted: 10, callFailures: 2, unscored: 1, correct: 5 });
  assert.equal(agg.scored, 7);
  assert.equal(agg.accuracy, 71.4); // 5/7, not 5/10
  assert.equal(agg.failureRate, 30); // (2 + 1) / 10
  assert.ok(agg.ci && agg.ci.lower < 71.4 && agg.ci.upper > 71.4);

  const none = aggregateRun({ attempted: 4, callFailures: 3, unscored: 1, correct: 0 });
  assert.equal(none.scored, 0);
  assert.equal(none.accuracy, null);
  assert.equal(none.ci, null);
  assert.equal(none.failureRate, 100);

  assert.equal(aggregateRun({ attempted: 0, callFailures: 0, unscored: 0, correct: 0 }).failureRate, 0);
});

test("orderQuestionsBySample: numeric sample_index, then created_at; missing index last", () => {
  const q = (idx: unknown, created: string) => ({ metadata: idx === undefined ? {} : { sample_index: idx }, created_at: created, id: `${idx}-${created}` });
  const ordered = orderQuestionsBySample([
    q(10, "2026-01-01T00:00:00Z"),
    q(undefined, "2026-01-01T00:00:00Z"),
    q(2, "2026-01-03T00:00:00Z"),
    q(0, "2026-01-02T00:00:00Z"),
  ]);
  assert.deepEqual(ordered.map((x) => x.metadata.sample_index), [0, 2, 10, undefined]);
});

// ---------- stall detection vs. long batch runs ----------

test("stall detection: a long batch run that keeps inserting results is not stalled", () => {
  const T0 = Date.UTC(2026, 0, 1);
  const row = { status: "running" as const, started_at: new Date(T0).toISOString(), created_at: new Date(T0).toISOString() };
  const now = T0 + 3 * EVAL_STALL_THRESHOLD_MS;
  assert.equal(isStalledRunning(row, now), true);
  assert.equal(isStalledRunning(row, now, now - 30_000), false);
  assert.equal(isStalledRunning(row, now, now - EVAL_ACTIVITY_WINDOW_MS - 1), true);

  // A long batch run finalized as failed by the runner (it wrote its attempted count) is not "reaped".
  const failed = {
    status: "failed" as const,
    started_at: new Date(T0).toISOString(),
    created_at: new Date(T0).toISOString(),
    completed_at: new Date(now).toISOString(),
    accuracy: null,
  };
  assert.equal(wasReapedAsStalled({ ...failed, questions_evaluated: 42 }), false);
  assert.equal(wasReapedAsStalled({ ...failed, questions_evaluated: 0 }), true);
});
