import test from "node:test";
import assert from "node:assert/strict";
import { ExactMatchScorer } from "../../src/lib/eval/scorers/exact-match";
import { NormalizedMatchScorer } from "../../src/lib/eval/scorers/normalized-match";
import { LLMJudgeScorer } from "../../src/lib/eval/scorers/llm-judge";
import { getScorer } from "../../src/lib/eval/scorers/factory";

test("ExactMatchScorer: direct option match", () => {
  const scorer = new ExactMatchScorer();
  const res = scorer.score("B", "B");
  assert.equal(res.isCorrect, true);
  assert.equal(res.score, 1.0);
});

test("ExactMatchScorer: extracts option from conversational response", () => {
  const scorer = new ExactMatchScorer();
  const res = scorer.score("Based on the laws of physics, the correct answer is (C).", "C");
  assert.equal(res.isCorrect, true);
  assert.equal(res.score, 1.0);
});

test("ExactMatchScorer: detects incorrect option extraction", () => {
  const scorer = new ExactMatchScorer();
  const res = scorer.score("The answer is (A).", "D");
  assert.equal(res.isCorrect, false);
  assert.equal(res.score, 0.0);
});

test("NormalizedMatchScorer: extracts GSM8K final #### delimiter", () => {
  const scorer = new NormalizedMatchScorer();
  const response = "Natalia sold 48 clips in April and 24 in May. Total = 72. #### 72";
  const res = scorer.score(response, "72");
  assert.equal(res.isCorrect, true);
  assert.equal(res.score, 1.0);
});

test("NormalizedMatchScorer: handles LaTeX \\boxed{} format", () => {
  const scorer = new NormalizedMatchScorer();
  const response = "Simplifying the polynomial yields \\boxed{42}.";
  const res = scorer.score(response, "42");
  assert.equal(res.isCorrect, true);
});

test("NormalizedMatchScorer: handles dollar signs and trailing periods", () => {
  const scorer = new NormalizedMatchScorer();
  const response = "The total profit was $1,500.";
  const res = scorer.score(response, "1500");
  assert.equal(res.isCorrect, true);
});

test("LLMJudgeScorer: graceful heuristic fallback without API key", async () => {
  const scorer = new LLMJudgeScorer();
  const response = "To optimize SQL queries, use proper indexing on join keys and avoid SELECT *.";
  const expected = "Use indexes on join columns and select only required attributes.";
  const res = await scorer.score(response, expected);

  assert.equal(typeof res.isCorrect, "boolean");
  assert.ok(res.score >= 0 && res.score <= 1.0);
  assert.ok(res.reasoning && res.reasoning.length > 0);
});

test("Scorer Factory: returns correct scorer instances", () => {
  assert.equal(getScorer("exact_match").name, "exact_match");
  assert.equal(getScorer("normalized_match").name, "normalized_match");
  assert.equal(getScorer("pass_at_k").name, "pass_at_k");
  assert.equal(getScorer("llm_judge").name, "llm_judge");
});
