import test from "node:test";
import assert from "node:assert/strict";
import { ExactMatchScorer, extractChoiceLetter } from "../../src/lib/eval/scorers/exact-match";
import {
  NormalizedMatchScorer,
  extractNumericAnswer,
  findNumbers,
} from "../../src/lib/eval/scorers/normalized-match";
import {
  extractLastBoxed,
  latexAnswersEquivalent,
  normalizeLatexAnswer,
} from "../../src/lib/eval/scorers/latex";
import {
  LLMJudgeScorer,
  parseJudgeVerdict,
  type JudgeClient,
  type JudgeCompletion,
} from "../../src/lib/eval/scorers/llm-judge";
import { PassAtKScorer, extractJavaScript } from "../../src/lib/eval/scorers/pass-at-k";
import { preprocessResponse } from "../../src/lib/eval/scorers/preprocess";
import { isUnscoredResult } from "../../src/lib/eval/scorers/unscored";
import { getScorer } from "../../src/lib/eval/scorers/factory";
import { OpenRouterError } from "../../src/lib/openrouter/client";

// ─── Preprocessing ──────────────────────────────────────────────────────────────

test("preprocess: strips <think>, <reasoning> and dangling reasoning tags", () => {
  assert.equal(preprocessResponse("<think>Maybe A? No, B.</think>\nAnswer: C"), "Answer: C");
  assert.equal(preprocessResponse("<reasoning>long</reasoning> 42 "), "42");
  assert.equal(preprocessResponse("scratch work A B </think>Answer: D"), "Answer: D");
  assert.equal(preprocessResponse("Answer: B <think>truncated mid-thought A"), "Answer: B");
  assert.equal(preprocessResponse(undefined), "");
});

// ─── exact_match ────────────────────────────────────────────────────────────────

const mc = new ExactMatchScorer();
const four = { format: "multiple_choice", choices_count: 4 };
const ten = { format: "multiple_choice", choices_count: 10 };

test("exact_match: canonical instruction format", () => {
  assert.equal(mc.score("Answer: B", "B", four).isCorrect, true);
  assert.equal(mc.score("Some reasoning.\n\nAnswer: C", "C", four).isCorrect, true);
  assert.equal(mc.score("Answer: C", "B", four).isCorrect, false);
});

test("exact_match: think blocks are ignored", () => {
  const res = mc.score("<think>The answer is A... wait, Answer: A is wrong.</think>\nAnswer: D", "D", four);
  assert.equal(res.isCorrect, true);
  assert.equal(res.metadata?.extracted, "D");
});

test("exact_match: parenthesized, bold and markdown answer statements", () => {
  assert.equal(mc.score("Answer: (C)", "C", four).isCorrect, true);
  assert.equal(mc.score("The correct answer is (C).", "C", four).isCorrect, true);
  assert.equal(mc.score("**Answer:** B", "B", four).isCorrect, true);
  assert.equal(mc.score("**Answer: A**", "A", four).isCorrect, true);
  assert.equal(mc.score("The final answer is: [D]", "D", four).isCorrect, true);
  assert.equal(mc.score("So the answer is \\boxed{B}.", "B", four).isCorrect, true);
  assert.equal(mc.score("The correct option is C.", "C", four).isCorrect, true);
  assert.equal(mc.score("After elimination, **C** remains.", "C", four).isCorrect, true);
});

test("exact_match: lowercase letters only where they cannot be a word", () => {
  assert.equal(mc.score("answer: c", "C", four).isCorrect, true);
  assert.equal(mc.score("The answer is (b).", "B", four).isCorrect, true);
  assert.equal(mc.score("d", "D", four).isCorrect, true);
  // "a" is an article here, not option A.
  const res = mc.score("The answer is a tricky one, but (C) is right.", "C", four);
  assert.equal(res.isCorrect, true);
  assert.equal(res.metadata?.extracted, "C");
});

test("exact_match: multiple candidates → the last one wins", () => {
  const response = "Answer: A\nHmm, let me reconsider the second premise.\nAnswer: C";
  assert.equal(mc.score(response, "C", four).isCorrect, true);
  assert.equal(mc.score(response, "A", four).isCorrect, false);
  assert.equal(mc.score("(A) is wrong, (B) is wrong, so (D).", "D", four).isCorrect, true);
});

test("exact_match: explicit answer statement beats earlier option discussion", () => {
  const response = "Option (A) fails. **B** is tempting but wrong.\nAnswer: D";
  assert.equal(mc.score(response, "D", four).metadata?.method, "answer_statement");
});

test("exact_match: a rejected alternative after the explicit answer does not win", () => {
  assert.equal(extractChoiceLetter("The answer is B, not C.", 4)?.letter, "B");
  assert.equal(extractChoiceLetter("Answer: B, not C", 4)?.letter, "B");
  assert.equal(extractChoiceLetter("Final answer: B (not C)", 4)?.letter, "B");
  assert.equal(extractChoiceLetter("the answer is definitely C.", 4)?.letter, "C");
  // Pronoun "I" is not option I (MMLU-Pro has A-J).
  assert.equal(extractChoiceLetter("Answer: I think it's B", 10)?.letter, "B");
});

test("exact_match: never matches letters inside words", () => {
  assert.equal(mc.score("The answer is definitely C.", "C", four).isCorrect, true);
  assert.equal(mc.score("Based on the analysis, Canberra.", "B", four).isCorrect, false);
  assert.equal(mc.score("Answer: Canberra", "C", four).metadata?.extracted, null);
  assert.equal(extractChoiceLetter("I think it's about Australia.", 4), null);
});

test("exact_match: letters outside A..choices_count do not count", () => {
  // 4-choice question: "E" is not an option.
  assert.equal(mc.score("Answer: E", "A", four).metadata?.extracted, null);
  // MMLU-Pro has up to J.
  assert.equal(mc.score("Answer: J", "J", ten).isCorrect, true);
  assert.equal(mc.score("Answer: I", "I", ten).isCorrect, true);
});

test("exact_match: lone letter and leading option label", () => {
  assert.equal(mc.score("B", "B", four).isCorrect, true);
  assert.equal(mc.score("(C)", "C", four).isCorrect, true);
  assert.equal(mc.score("C. Canberra is the capital.", "C", four).isCorrect, true);
  assert.equal(mc.score("B) Merge Sort", "B", four).isCorrect, true);
});

test("exact_match: no extractable letter is a real miss, not unscored", () => {
  const res = mc.score("I am not sure about this one.", "B", four);
  assert.equal(res.isCorrect, false);
  assert.match(res.reasoning ?? "", /No answer letter found/);
  assert.equal(isUnscoredResult(res), false);
});

test("exact_match: free-text expected answers use normalized equality", () => {
  assert.equal(mc.score("Paris.", "Paris").isCorrect, true);
  assert.equal(mc.score("The answer is Paris", "paris").isCorrect, true);
  assert.equal(mc.score("Not Paris", "Paris").isCorrect, false);
});

// ─── normalized_match: numeric (GSM8K) ──────────────────────────────────────────

const nm = new NormalizedMatchScorer();
const numeric = { format: "numeric" };
const latex = { format: "latex" };

test("normalized_match numeric: 'Answer: N' line wins over later numbers", () => {
  const res = nm.score("48 + 24 = 72 clips.\nAnswer: 72\n(That is 3 more than 69.)", "72", numeric);
  assert.equal(res.isCorrect, true);
  assert.equal(res.metadata?.source, "answer line");
});

test("normalized_match numeric: commas, dollars, percent and units", () => {
  assert.equal(nm.score("Answer: $1,500", "1500", numeric).isCorrect, true);
  assert.equal(nm.score("**Answer:** 1,234,567 dollars", "1234567", numeric).isCorrect, true);
  assert.equal(nm.score("Answer: 25%", "25", numeric).isCorrect, true);
  assert.equal(nm.score("Answer: 18.00", "18", numeric).isCorrect, true);
  assert.equal(nm.score("The total profit was $1,500.", "1500", numeric).isCorrect, true);
});

test("normalized_match numeric: fallbacks (#### / boxed / last number) and negatives", () => {
  assert.equal(nm.score("Total = 72. #### 72", "72", numeric).isCorrect, true);
  assert.equal(nm.score("So we get \\boxed{1,000}.", "1000", numeric).isCorrect, true);
  assert.equal(nm.score("First 10 - 3 = 7, then 7 * 2 = 14", "14", numeric).isCorrect, true);
  assert.equal(nm.score("The temperature fell to -5 degrees.", "-5", numeric).isCorrect, true);
  assert.equal(nm.score("The result is 71.", "72", numeric).isCorrect, false);
});

test("normalized_match numeric: subtraction is not a negative sign; prose 'answer' is not an answer line", () => {
  assert.deepEqual(
    findNumbers("10-3=7").map((n) => n.value),
    [10, 3, 7]
  );
  assert.equal(extractNumericAnswer("To answer 3 questions she needs 12 minutes each, so 36.")?.value, 36);
});

test("normalized_match numeric: think block content is ignored", () => {
  assert.equal(nm.score("<think>Maybe 50? Answer: 50</think>Answer: 42", "42", numeric).isCorrect, true);
});

test("normalized_match numeric: no number → real miss; non-numeric reference → unscored", () => {
  const miss = nm.score("I cannot determine this.", "12", numeric);
  assert.equal(miss.isCorrect, false);
  assert.equal(isUnscoredResult(miss), false);
  assert.equal(isUnscoredResult(nm.score("Answer: 3", "three", numeric)), true);
});

// ─── normalized_match: LaTeX (MATH-500) ─────────────────────────────────────────

test("latex: extracts the LAST boxed answer with nested braces", () => {
  assert.equal(extractLastBoxed("First \\boxed{1}, finally \\boxed{\\frac{\\sqrt{3}}{2}}."), "\\frac{\\sqrt{3}}{2}");
  assert.equal(extractLastBoxed("\\boxed{\\left( 3, \\frac{\\pi}{2} \\right)}"), "\\left( 3, \\frac{\\pi}{2} \\right)");
  assert.equal(extractLastBoxed("\\boxed{\\{1,2\\}}"), "\\{1,2\\}");
  assert.equal(extractLastBoxed("so \\boxed 5"), "5");
  assert.equal(extractLastBoxed("unterminated \\boxed{12"), null);
  assert.equal(extractLastBoxed("no box here"), null);
});

test("latex: normalization rules", () => {
  assert.equal(normalizeLatexAnswer("\\dfrac{14}{3}"), "\\frac{14}{3}");
  assert.equal(normalizeLatexAnswer("\\frac12"), "\\frac{1}{2}");
  assert.equal(normalizeLatexAnswer("\\left( 3, \\frac{\\pi}{2} \\right)"), "(3,\\frac{\\pi}{2})");
  assert.equal(normalizeLatexAnswer("\\text{Evelyn}"), "Evelyn");
  assert.equal(normalizeLatexAnswer("90^\\circ"), "90");
  assert.equal(normalizeLatexAnswer("50\\%"), "50");
  assert.equal(normalizeLatexAnswer("10{,}000"), "10000");
  assert.equal(normalizeLatexAnswer("5\\text{ cm}"), "5");
  assert.equal(normalizeLatexAnswer("x = 4", { stripVariablePrefix: true }), "4");
  assert.equal(normalizeLatexAnswer("\\sqrt2"), "\\sqrt{2}");
});

test("normalized_match latex: equivalent forms are correct", () => {
  assert.equal(nm.score("Thus \\boxed{\\dfrac{14}{3}}.", "\\frac{14}{3}", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{\\left(3, \\frac{\\pi}{2}\\right)}", "\\left( 3, \\frac{\\pi}{2} \\right)", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{x=4}", "4", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{0.5}", "\\frac{1}{2}", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{\\frac{-3}{4}}", "-\\frac{3}{4}", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{90^\\circ}", "90", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{\\text{Evelyn}}", "\\text{Evelyn}", latex).isCorrect, true);
  assert.equal(nm.score("\\boxed{42}.", "42", latex).isCorrect, true);
});

test("normalized_match latex: wrong or missing answers", () => {
  assert.equal(nm.score("\\boxed{\\frac{14}{5}}", "\\frac{14}{3}", latex).isCorrect, false);
  // Last boxed wins even if an earlier one was right.
  assert.equal(nm.score("\\boxed{7} ... actually \\boxed{8}", "7", latex).isCorrect, false);
  // Keeps "x=" when the reference itself has it: "y=4" vs "x=4" differ.
  assert.equal(latexAnswersEquivalent("y=4", "x=4"), false);
  // Documented limitation: no symbolic equivalence.
  assert.equal(latexAnswersEquivalent("\\frac{1}{\\sqrt{2}}", "\\frac{\\sqrt{2}}{2}"), false);
  const missing = nm.score("The answer is fourteen thirds.", "\\frac{14}{3}", latex);
  assert.equal(missing.isCorrect, false);
  assert.equal(isUnscoredResult(missing), false);
});

// ─── pass_at_k (execution) ──────────────────────────────────────────────────────

/** Real MultiPL-E row: nuprl/MultiPL-E, config humaneval-js, split test, row 0. */
const HUMANEVAL_JS_0 = {
  entry_point: "has_close_elements",
  tests:
    "const assert = require('node:assert');\n\n\nfunction test() {\n  let candidate = has_close_elements;\n  assert.deepEqual(candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3),true);\n  assert.deepEqual(candidate([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.05),false);\n  assert.deepEqual(candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.95),true);\n  assert.deepEqual(candidate([1.0, 2.0, 5.9, 4.0, 5.0], 0.8),false);\n  assert.deepEqual(candidate([1.0, 2.0, 3.0, 4.0, 5.0, 2.0], 0.1),true);\n  assert.deepEqual(candidate([1.1, 2.2, 3.1, 4.1, 5.1], 1.0),true);\n  assert.deepEqual(candidate([1.1, 2.2, 3.1, 4.1, 5.1], 0.5),false);\n}\n\ntest();",
};

const codeMeta = {
  format: "code",
  language: "javascript",
  entry_point: HUMANEVAL_JS_0.entry_point,
  tests: HUMANEVAL_JS_0.tests,
  stop_tokens: ["\nfunction ", "\n/*", "\n//", "\nconsole.log"],
};

const CORRECT_SOLUTION = [
  "Here is the implementation:",
  "",
  "```javascript",
  "function has_close_elements(numbers, threshold){",
  "  for (let i = 0; i < numbers.length; i++) {",
  "    for (let j = i + 1; j < numbers.length; j++) {",
  "      if (Math.abs(numbers[i] - numbers[j]) < threshold) return true;",
  "    }",
  "  }",
  "  return false;",
  "}",
  "```",
].join("\n");

test("pass_at_k: correct MultiPL-E solution passes by execution", async () => {
  const res = await new PassAtKScorer().score(CORRECT_SOLUTION, "", codeMeta);
  assert.equal(res.isCorrect, true, res.reasoning);
  assert.equal(res.score, 1);
  assert.equal(res.metadata?.sandbox, "passed");
});

test("pass_at_k: a plausible-looking but wrong solution fails (no signature-regex pass)", async () => {
  const wrong = "```js\nfunction has_close_elements(numbers, threshold){\n  return numbers.length > 1;\n}\n```";
  const res = await new PassAtKScorer().score(wrong, "", codeMeta);
  assert.equal(res.isCorrect, false);
  assert.match(res.reasoning ?? "", /AssertionError/);
});

test("pass_at_k: Python answer to a JS task fails", async () => {
  const python = "```python\ndef has_close_elements(numbers, threshold):\n    return False\n```";
  const res = await new PassAtKScorer().score(python, "", codeMeta);
  assert.equal(res.isCorrect, false);
  assert.equal(res.metadata?.phase, "candidate");
});

test("pass_at_k: infinite loop times out and fails", async () => {
  const loop = "```javascript\nfunction has_close_elements(numbers, threshold){ while (true) {} }\n```";
  const res = await new PassAtKScorer({ timeoutMs: 1_000 }).score(loop, "", codeMeta);
  assert.equal(res.isCorrect, false);
  assert.equal(res.metadata?.sandbox, "timeout");
  assert.equal(isUnscoredResult(res), false);
});

test("pass_at_k: think blocks are stripped before extracting code", async () => {
  const res = await new PassAtKScorer().score(
    "<think>```javascript\nfunction has_close_elements(){ return true; }\n```</think>\n" + CORRECT_SOLUTION,
    "",
    codeMeta
  );
  assert.equal(res.isCorrect, true, res.reasoning);
});

test("pass_at_k: missing tests or unsupported language → unscored", async () => {
  const scorer = new PassAtKScorer();
  assert.equal(isUnscoredResult(await scorer.score(CORRECT_SOLUTION, "", { entry_point: "x" })), true);
  assert.equal(
    isUnscoredResult(await scorer.score(CORRECT_SOLUTION, "", { ...codeMeta, language: "python" })),
    true
  );
});

test("pass_at_k: empty response is a real miss", async () => {
  const res = await new PassAtKScorer().score("   ", "", codeMeta);
  assert.equal(res.isCorrect, false);
  assert.equal(isUnscoredResult(res), false);
});

test("extractJavaScript: block selection and export stripping", () => {
  const multi = [
    "```js",
    "console.log(foo([1]));",
    "```",
    "```javascript",
    "export function foo(xs) { return xs.length; }",
    "```",
  ].join("\n");
  assert.equal(extractJavaScript(multi, "foo"), "function foo(xs) { return xs.length; }");
  assert.equal(extractJavaScript("const foo = (x) => x;", "foo"), "const foo = (x) => x;");
  assert.equal(extractJavaScript("```\nfunction foo(){}\n```", "foo"), "function foo(){}");
  // Truncated response with an unterminated fence.
  assert.equal(extractJavaScript("```javascript\nfunction foo(){ return 1; }", "foo"), "function foo(){ return 1; }");
});

// ─── llm_judge ──────────────────────────────────────────────────────────────────

function fakeClient(reply: string | Error): JudgeClient {
  return {
    async createChatCompletion(): Promise<JudgeCompletion> {
      if (reply instanceof Error) throw reply;
      return { text: reply, latencyMs: 5 };
    },
  };
}

const JUDGE_MODEL = "google/gemma-4-31b-it:free";
const ctx = { prompt: "Name the capital of Australia." };

test("llm_judge: parses pass/fail verdicts", async () => {
  const pass = await new LLMJudgeScorer(JUDGE_MODEL, fakeClient('{"verdict": "pass", "reasoning": "Correct."}')).score(
    "Canberra.",
    "Canberra",
    {},
    ctx
  );
  assert.equal(pass.isCorrect, true);
  assert.equal(pass.score, 1);
  assert.match(pass.reasoning ?? "", /PASS/);

  const fail = await new LLMJudgeScorer(
    JUDGE_MODEL,
    fakeClient('<think>hmm</think>```json\n{"verdict": "fail", "reasoning": "Says Sydney."}\n```')
  ).score("Sydney.", "Canberra", {}, ctx);
  assert.equal(fail.isCorrect, false);
  assert.equal(isUnscoredResult(fail), false);
});

test("llm_judge: judge failure → UNSCORED, never a heuristic score", async () => {
  const res = await new LLMJudgeScorer(JUDGE_MODEL, fakeClient(new Error("OpenRouter rate limited (429)"))).score(
    "Canberra is the capital.",
    "Canberra",
    {},
    ctx
  );
  assert.equal(res.isCorrect, false);
  assert.equal(res.score, 0);
  assert.equal(isUnscoredResult(res), true);
  assert.match(res.reasoning ?? "", /429/);
});

test("llm_judge: judge failure carries the OpenRouter error kind for the runner's quota stop", async () => {
  const quota = new OpenRouterError("Rate limit exceeded: free-models-per-day", 429, "daily_quota_exhausted");
  const res = await new LLMJudgeScorer(JUDGE_MODEL, fakeClient(quota)).score("Canberra.", "Canberra", {}, ctx);
  assert.equal(isUnscoredResult(res), true);
  assert.equal(res.metadata?.errorKind, "daily_quota_exhausted");
});

test("llm_judge: a baseline model output is framed as a baseline, not a gold answer", async () => {
  let prompt = "";
  const client: JudgeClient = {
    async createChatCompletion(options) {
      prompt = options.messages.map((m) => m.content).join("\n");
      return { text: '{"verdict":"pass","reasoning":"better than baseline"}', latencyMs: 1 };
    },
  };
  const res = await new LLMJudgeScorer(JUDGE_MODEL, client).score(
    "Roses bloom in morning light...",
    "Roses are red, violets are blue.",
    { reference_generator: "text_davinci_003" },
    { prompt: "Write a short poem about roses." }
  );
  assert.equal(res.isCorrect, true);
  assert.equal(res.metadata?.referenceKind, "baseline");
  assert.match(prompt, /BASELINE RESPONSE FROM ANOTHER MODEL/);
  assert.doesNotMatch(prompt, /\[REFERENCE ANSWER\]/);

  await new LLMJudgeScorer(JUDGE_MODEL, client).score("4", "4", {}, { prompt: "What is 2+2?" });
  assert.match(prompt, /\[REFERENCE ANSWER\]/);
});

test("llm_judge: unparseable verdict → UNSCORED", async () => {
  const res = await new LLMJudgeScorer(JUDGE_MODEL, fakeClient("I think it is decent.")).score(
    "Canberra.",
    "Canberra",
    {},
    ctx
  );
  assert.equal(isUnscoredResult(res), true);
});

test("llm_judge: nothing to judge against → UNSCORED; empty response → real miss", async () => {
  const scorer = new LLMJudgeScorer(JUDGE_MODEL, fakeClient('{"verdict":"pass","reasoning":"x"}'));
  assert.equal(isUnscoredResult(await scorer.score("Some answer", "")), true);
  const empty = await scorer.score("  ", "Canberra", {}, ctx);
  assert.equal(empty.isCorrect, false);
  assert.equal(isUnscoredResult(empty), false);
});

test("llm_judge: non-free judge model ids are refused in favour of the free default", async () => {
  let usedModel = "";
  const client: JudgeClient = {
    async createChatCompletion(options) {
      usedModel = options.model;
      return { text: '{"verdict":"pass","reasoning":"ok"}', latencyMs: 1 };
    },
  };
  await new LLMJudgeScorer("openai/gpt-4o", client).score("Canberra", "Canberra", {}, ctx);
  assert.ok(usedModel.endsWith(":free"));
});

test("parseJudgeVerdict: tolerant of braces in reasoning and bare verdict lines", () => {
  assert.equal(parseJudgeVerdict('{"verdict": "pass", "reasoning": "uses {x} correctly"}')?.pass, true);
  assert.equal(parseJudgeVerdict("VERDICT: FAIL — misses the second part.")?.pass, false);
  assert.equal(parseJudgeVerdict("no idea"), null);
});

// ─── Factory ────────────────────────────────────────────────────────────────────

test("Scorer Factory: returns correct scorer instances", () => {
  assert.equal(getScorer("exact_match").name, "exact_match");
  assert.equal(getScorer("normalized_match").name, "normalized_match");
  assert.equal(getScorer("pass_at_k").name, "pass_at_k");
  assert.equal(getScorer("llm_judge").name, "llm_judge");
});

test("Scorer Factory: unsupported methods throw instead of silently falling back", () => {
  assert.throws(() => getScorer("bleu"), /no registered scorer/);
  assert.throws(() => getScorer("nonsense"), /no registered scorer/);
});
