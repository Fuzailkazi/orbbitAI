import test from "node:test";
import assert from "node:assert/strict";
import {
  scoredQuestionCount,
  formatCI,
  formatCIMargin,
  formatContext,
  formatCost,
  formatLatency,
  formatModelName,
  formatPct,
  formatPricePerMillion,
  formatVendor,
  resolveCI,
} from "../../src/lib/format";
import { calculateWilsonConfidenceInterval } from "../../src/lib/eval/statistics";

const DASH = "—";

// ---------------------------------------------------------------------------
// resolveCI
// ---------------------------------------------------------------------------

test("resolveCI: prefers stored Wilson bounds", () => {
  const ci = resolveCI({
    accuracy: 97.8,
    accuracy_ci_lower: 96.1,
    accuracy_ci_upper: 98.8,
    questions_evaluated: 500,
    questions_correct: 489,
  });
  assert.deepEqual(ci, { accuracy: 97.8, lower: 96.1, upper: 98.8, source: "stored" });
});

test("resolveCI: computes Wilson bounds from counts when bounds are missing", () => {
  const ci = resolveCI({
    accuracy: 90,
    accuracy_ci_lower: null,
    accuracy_ci_upper: null,
    questions_evaluated: 100,
    questions_correct: 90,
  });
  const expected = calculateWilsonConfidenceInterval(90, 100);
  assert.equal(ci.source, "computed");
  assert.equal(ci.accuracy, 90);
  assert.equal(ci.lower, expected.lower);
  assert.equal(ci.upper, expected.upper);
  assert.ok(ci.lower !== null && ci.upper !== null && ci.lower < 90 && ci.upper > 90);
});

test("resolveCI: derives accuracy from counts when accuracy is null", () => {
  const ci = resolveCI({ accuracy: null, questions_evaluated: 40, questions_correct: 30 });
  assert.equal(ci.accuracy, 75);
  assert.equal(ci.source, "computed");
});

test("resolveCI: backs out the correct count from accuracy × n", () => {
  const ci = resolveCI({ accuracy: 80, questions_evaluated: 50 });
  const expected = calculateWilsonConfidenceInterval(40, 50);
  assert.equal(ci.source, "computed");
  assert.equal(ci.lower, expected.lower);
  assert.equal(ci.upper, expected.upper);
});

test("resolveCI: a single stored bound is not treated as stored", () => {
  const ci = resolveCI({
    accuracy: 50,
    accuracy_ci_lower: 40,
    accuracy_ci_upper: null,
    questions_evaluated: 20,
    questions_correct: 10,
  });
  assert.equal(ci.source, "computed");
});

test("resolveCI: returns no bounds when the sample size is unknown", () => {
  assert.deepEqual(resolveCI({ accuracy: 75 }), { accuracy: 75, lower: null, upper: null, source: "none" });
  assert.deepEqual(resolveCI({ accuracy: 75, questions_evaluated: 0, questions_correct: 0 }), {
    accuracy: 75,
    lower: null,
    upper: null,
    source: "none",
  });
  assert.deepEqual(resolveCI({ accuracy: null }), { accuracy: null, lower: null, upper: null, source: "none" });
});

test("resolveCI: ignores NaN inputs", () => {
  const ci = resolveCI({ accuracy: Number.NaN, questions_evaluated: Number.NaN, questions_correct: 3 });
  assert.deepEqual(ci, { accuracy: null, lower: null, upper: null, source: "none" });
});

// ---------------------------------------------------------------------------
// formatCost
// ---------------------------------------------------------------------------

test("formatCost: zero and missing values", () => {
  assert.equal(formatCost(0), "$0");
  assert.equal(formatCost(null), DASH);
  assert.equal(formatCost(undefined), DASH);
  assert.equal(formatCost(Number.NaN), DASH);
});

test("formatCost: never renders $0.00 for sub-cent values", () => {
  assert.equal(formatCost(0.0012), "$0.0012");
  assert.equal(formatCost(0.000042), "$0.000042");
  assert.equal(formatCost(0.001), "$0.001");
  assert.notEqual(formatCost(0.004), "$0.00");
});

test("formatCost: cents and dollars", () => {
  assert.equal(formatCost(0.25), "$0.25");
  assert.equal(formatCost(1.2), "$1.20");
  assert.equal(formatCost(1234.5), "$1,234.50");
  assert.equal(formatCost(-0.5), "-$0.50");
});

test("formatPricePerMillion: free vs priced", () => {
  assert.equal(formatPricePerMillion(0), "Free");
  assert.equal(formatPricePerMillion(2.5), "$2.50/M");
  assert.equal(formatPricePerMillion(null), DASH);
});

// ---------------------------------------------------------------------------
// formatVendor
// ---------------------------------------------------------------------------

test("formatVendor: maps known OpenRouter slugs", () => {
  assert.equal(formatVendor("openai"), "OpenAI");
  assert.equal(formatVendor("x-ai"), "xAI");
  assert.equal(formatVendor("meta-llama"), "Meta");
  assert.equal(formatVendor("mistralai"), "Mistral");
  assert.equal(formatVendor("aion-labs"), "Aion Labs");
  assert.equal(formatVendor("moonshotai"), "Moonshot AI");
});

test("formatVendor: is case- and whitespace-insensitive for known vendors", () => {
  assert.equal(formatVendor("OpenAI"), "OpenAI");
  assert.equal(formatVendor("  DEEPSEEK "), "DeepSeek");
  assert.equal(formatVendor("Google DeepMind"), "Google DeepMind");
});

test("formatVendor: strips OpenRouter's '~' alias prefix", () => {
  assert.equal(formatVendor("~openai"), "OpenAI");
  assert.equal(formatVendor("~anthropic"), "Anthropic");
  assert.equal(formatVendor("~"), "Unknown");
});

test("formatVendor: title-cases unknown slugs and keeps human-cased names", () => {
  assert.equal(formatVendor("some-new_lab"), "Some New Lab");
  assert.equal(formatVendor("HuggingFaceH4"), "HuggingFaceH4");
  assert.equal(formatVendor(null), "Unknown");
  assert.equal(formatVendor(""), "Unknown");
});

// ---------------------------------------------------------------------------
// formatContext
// ---------------------------------------------------------------------------

test("formatContext: compact context windows", () => {
  assert.equal(formatContext(950), "950");
  assert.equal(formatContext(8192), "8.2K");
  assert.equal(formatContext(128000), "128K");
  assert.equal(formatContext(131072), "131K");
  assert.equal(formatContext(1048576), "1.05M");
  assert.equal(formatContext(2_000_000), "2M");
  assert.equal(formatContext(2.5e9), "2.5B");
  assert.equal(formatContext(null), DASH);
});

// ---------------------------------------------------------------------------
// Other display helpers
// ---------------------------------------------------------------------------

test("formatPct / formatCI / formatCIMargin", () => {
  assert.equal(formatPct(97.84), "97.8%");
  assert.equal(formatPct(null), DASH);
  assert.equal(formatCI(96.1, 98.8), "96.1–98.8");
  assert.equal(formatCI(96.1, null), DASH);
  assert.equal(formatCIMargin(96.1, 98.8), "±1.4");
});

test("formatLatency", () => {
  assert.equal(formatLatency(842), "842ms");
  assert.equal(formatLatency(1520), "1.52s");
  assert.equal(formatLatency(65_000), "1m 5s");
  assert.equal(formatLatency(120_000), "2m");
});

test("formatModelName strips an OpenRouter vendor prefix", () => {
  assert.equal(formatModelName("OpenAI: GPT-4o"), "GPT-4o");
  assert.equal(formatModelName("Claude Opus 4"), "Claude Opus 4");
  assert.equal(formatModelName(null), DASH);
});

test("scoredQuestionCount: failed/unscored prompts leave the accuracy denominator", () => {
  assert.equal(scoredQuestionCount({ questions_evaluated: 40, failure_rate: 0 }), 40);
  assert.equal(scoredQuestionCount({ questions_evaluated: 40, failure_rate: 25 }), 30);
  // failure_rate is stored to 0.1%: 7/137 = 5.1% → 130 scored after rounding.
  assert.equal(scoredQuestionCount({ questions_evaluated: 137, failure_rate: 5.1 }), 130);
  assert.equal(scoredQuestionCount({ questions_evaluated: 10, failure_rate: null }), 10);
  assert.equal(scoredQuestionCount({ questions_evaluated: 0, failure_rate: 50 }), 0);
  assert.equal(scoredQuestionCount({ questions_evaluated: 10, failure_rate: 100 }), 0);
});

test("resolveCI: computed interval uses scored prompts, not attempted ones", () => {
  const ci = resolveCI({ accuracy: null, questions_evaluated: 20, questions_correct: 10, failure_rate: 50 });
  assert.equal(ci.accuracy, 100);
  assert.equal(ci.source, "computed");
});
