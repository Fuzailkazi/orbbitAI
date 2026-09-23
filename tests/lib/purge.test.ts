import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluationIdsToDelete,
  importCutoff,
  isFakeTrace,
  isHfQuestion,
  isSeededFingerprint,
  parsePurgeArgs,
  selectPurgeTargets,
  type PurgeBenchmarkRow,
  type PurgeEvaluationRow,
  type PurgeQuestionRow,
  type PurgeResultRow,
} from "../../scripts/purge-seeded-evaluations";

const T0 = Date.UTC(2026, 8, 20, 7, 26, 48);
const iso = (ms: number) => new Date(ms).toISOString();

function seededEval(id: string, overrides: Partial<PurgeEvaluationRow> = {}): PurgeEvaluationRow {
  return {
    id,
    model_id: "m1",
    benchmark_id: "b-mmlu",
    status: "completed",
    accuracy: 88.7,
    questions_evaluated: 500,
    questions_correct: 444,
    total_tokens: 120000,
    total_cost: 0,
    failure_rate: 0,
    started_at: iso(T0),
    completed_at: iso(T0 + 1),
    created_at: iso(Date.UTC(2026, 4, 4)),
    ...overrides,
  };
}

function realEval(id: string, overrides: Partial<PurgeEvaluationRow> = {}): PurgeEvaluationRow {
  return seededEval(id, {
    accuracy: 66.7,
    questions_evaluated: 3,
    questions_correct: 2,
    total_tokens: 1352,
    total_cost: 0,
    failure_rate: 33.3,
    started_at: iso(T0),
    completed_at: iso(T0 + 20_000),
    created_at: iso(T0),
    ...overrides,
  });
}

const benchmarks: PurgeBenchmarkRow[] = [
  { id: "b-mmlu", name: "MMLU", source_url: "https://huggingface.co/datasets/cais/mmlu" },
  { id: "b-custom", name: "My Suite", source_url: "custom-upload" },
];

const HF_IMPORT = Date.UTC(2026, 8, 24);
const syntheticQ: PurgeQuestionRow = { id: "q-syn", benchmark_id: "b-mmlu", metadata: { subject: "geo" }, created_at: iso(Date.UTC(2026, 8, 19)) };
const hfQ: PurgeQuestionRow = {
  id: "q-hf",
  benchmark_id: "b-mmlu",
  metadata: { source: "hf", dataset: "cais/mmlu", config: "all", split: "test", row_index: 7, sample_index: 0 },
  created_at: iso(HF_IMPORT),
};
const customQ: PurgeQuestionRow = { id: "q-custom", benchmark_id: "b-custom", metadata: {}, created_at: iso(Date.UTC(2026, 8, 19)) };

const fakeTrace = (id: string, evaluationId: string, questionId = "q-syn"): PurgeResultRow => ({
  id,
  evaluation_id: evaluationId,
  question_id: questionId,
  judge_reasoning: "Answer matches ground truth specification.",
});
const realResult = (id: string, evaluationId: string, questionId: string): PurgeResultRow => ({
  id,
  evaluation_id: evaluationId,
  question_id: questionId,
  judge_reasoning: "Extracted answer: B. Expected: B.",
});

test("isSeededFingerprint: matches the hand-entered shape (×240 and ×250, 0–1 ms duration)", () => {
  assert.equal(isSeededFingerprint(seededEval("a")), true);
  assert.equal(isSeededFingerprint(seededEval("a", { completed_at: iso(T0) })), true);
  assert.equal(isSeededFingerprint(seededEval("a", { total_tokens: 125000 })), true);
  // PostgREST may serialise numerics as strings.
  assert.equal(isSeededFingerprint(seededEval("a", { total_cost: "0", failure_rate: "0.000", total_tokens: "120000" })), true);
});

test("isSeededFingerprint: rejects anything that deviates, regardless of accuracy", () => {
  assert.equal(isSeededFingerprint(seededEval("a", { questions_evaluated: 499 })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { total_cost: 0.0117 })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { failure_rate: 0.2 })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { total_tokens: 118_934 })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { completed_at: iso(T0 + 60_000) })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { started_at: null })), false);
  assert.equal(isSeededFingerprint(seededEval("a", { status: "failed" })), false);
  assert.equal(isSeededFingerprint(realEval("a")), false);
});

test("isFakeTrace: recognises both fake trace generators and nothing else", () => {
  assert.equal(isFakeTrace("Answer matches ground truth specification."), true);
  assert.equal(isFakeTrace("Output does not match expected ground truth C."), true);
  assert.equal(
    isFakeTrace("Extracted answer matches ground truth expected solution for GPT-4o. Exact verification pass."),
    true
  );
  assert.equal(isFakeTrace("Model response failed verification against ground truth. Expected: 18."), true);
  assert.equal(isFakeTrace("Extracted answer: B. Expected: B."), false);
  assert.equal(isFakeTrace(null), false);
  assert.equal(isFakeTrace(""), false);
});

test("isHfQuestion / importCutoff", () => {
  assert.equal(isHfQuestion(hfQ.metadata), true);
  assert.equal(isHfQuestion(syntheticQ.metadata), false);
  assert.equal(isHfQuestion(null), false);
  assert.equal(isHfQuestion(["hf"]), false);
  assert.equal(importCutoff([syntheticQ]), null);
  assert.equal(importCutoff([syntheticQ, hfQ, { ...hfQ, id: "q2", created_at: iso(HF_IMPORT + 5000) }]), iso(HF_IMPORT));
});

test("selectPurgeTargets: seeded only by default; legacy untouched", () => {
  const selection = selectPurgeTargets({
    evaluations: [seededEval("s1"), seededEval("s2"), realEval("r1")],
    results: [fakeTrace("t1", "s1"), fakeTrace("t2", "s1"), realResult("x1", "r1", "q-syn")],
    questions: [syntheticQ],
    benchmarks,
    includeLegacy: false,
  });
  assert.deepEqual(selection.seeded.map((e) => e.id), ["s1", "s2"]);
  assert.equal(selection.seededNeedsReview.length, 0);
  assert.equal(selection.legacyWithSyntheticResults.length, 0);
  assert.equal(selection.legacyQuestions.length, 0);
  assert.deepEqual(evaluationIdsToDelete(selection), ["s1", "s2"]);
});

test("selectPurgeTargets: a fingerprint match with a non-fake result is held for review, never deleted", () => {
  const selection = selectPurgeTargets({
    evaluations: [seededEval("s1")],
    results: [fakeTrace("t1", "s1"), realResult("x1", "s1", "q-hf")],
    questions: [syntheticQ, hfQ],
    benchmarks,
    includeLegacy: true,
  });
  assert.equal(selection.seeded.length, 0);
  assert.equal(selection.seededNeedsReview.length, 1);
  assert.equal(selection.seededNeedsReview[0].unrecognizedResults, 1);
  assert.deepEqual(evaluationIdsToDelete(selection), []);
});

test("selectPurgeTargets: --include-legacy picks synthetic runs, pre-import empty runs and synthetic questions", () => {
  const selection = selectPurgeTargets({
    evaluations: [
      seededEval("s1"),
      realEval("legacy-run", { created_at: iso(T0) }),
      realEval("failed-empty", { status: "failed", created_at: iso(HF_IMPORT - 1000) }),
      realEval("stalled-after-import", { status: "running", created_at: iso(HF_IMPORT + 1000) }),
      realEval("hf-run", { created_at: iso(HF_IMPORT + 2000) }),
      realEval("custom-run", { benchmark_id: "b-custom" }),
      realEval("custom-empty", { benchmark_id: "b-custom", status: "failed" }),
    ],
    results: [
      fakeTrace("t1", "s1"),
      realResult("x1", "legacy-run", "q-syn"),
      realResult("x2", "hf-run", "q-hf"),
      realResult("x3", "custom-run", "q-custom"),
    ],
    questions: [syntheticQ, hfQ, customQ],
    benchmarks,
    includeLegacy: true,
  });
  assert.equal(selection.importCutoff, iso(HF_IMPORT));
  assert.deepEqual(selection.seeded.map((e) => e.id), ["s1"]);
  assert.deepEqual(selection.legacyWithSyntheticResults.map((e) => e.id), ["legacy-run"]);
  assert.deepEqual(selection.legacyWithoutResults.map((e) => e.id), ["failed-empty"]);
  // Custom-upload questions are real user data and HF questions are the new pipeline: both kept.
  assert.deepEqual(selection.legacyQuestions.map((q) => q.id), ["q-syn"]);
  assert.deepEqual(evaluationIdsToDelete(selection), ["s1", "legacy-run", "failed-empty"]);
});

test("selectPurgeTargets: with no HF import yet, every empty non-custom run is legacy", () => {
  const selection = selectPurgeTargets({
    evaluations: [realEval("empty", { status: "pending", created_at: iso(Date.UTC(2030, 0, 1)) })],
    results: [],
    questions: [syntheticQ],
    benchmarks,
    includeLegacy: true,
  });
  assert.equal(selection.importCutoff, null);
  assert.deepEqual(selection.legacyWithoutResults.map((e) => e.id), ["empty"]);
});

test("parsePurgeArgs: dry run by default, rejects unknown flags", () => {
  assert.deepEqual(parsePurgeArgs([]), { yes: false, includeLegacy: false, help: false });
  assert.deepEqual(parsePurgeArgs(["--yes", "--include-legacy"]), { yes: true, includeLegacy: true, help: false });
  assert.throws(() => parsePurgeArgs(["--force"]), /Unknown argument/);
});
