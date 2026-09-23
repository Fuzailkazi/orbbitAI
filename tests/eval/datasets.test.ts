import test from "node:test";
import assert from "node:assert/strict";
import { sampleIndices, seededPermutation, sampleSeedKey, hashString } from "../../src/lib/eval/datasets/sampler";
import {
  CODE_INSTRUCTION,
  LATEX_INSTRUCTION,
  MULTIPLE_CHOICE_INSTRUCTION,
  NUMERIC_INSTRUCTION,
  cleanHellaSwagText,
  extractEntryPoint,
  extractGsm8kAnswer,
  transformAlpacaEval,
  transformArc,
  transformGpqa,
  transformGsm8k,
  transformHellaSwag,
  transformMath500,
  transformMmlu,
  transformMmluPro,
  transformMtBench,
  transformMultiplE,
  transformTruthfulQaMc1,
  transformWinoGrande,
} from "../../src/lib/eval/datasets/transformers";
import { BENCHMARK_DATASETS, UNSUPPORTED_BENCHMARKS, buildQuestion, findDatasetConfig } from "../../src/lib/eval/datasets/configs";
import { buildSample } from "../../src/lib/eval/datasets/load";
import { planImport } from "../../src/lib/eval/datasets/reconcile";
import { planRowWindows } from "../../src/lib/eval/datasets/hf-client";
import { DatasetRowError, type BenchmarkDatasetConfig, type HfRow } from "../../src/lib/eval/datasets/types";

const ctx = { rowIndex: 7 };

function mustConfig(name: string): BenchmarkDatasetConfig {
  const config = findDatasetConfig(name);
  assert.ok(config, `missing config for ${name}`);
  return config;
}

// --- sampler -------------------------------------------------------------------

test("sampler: deterministic, distinct, in range", () => {
  const a = sampleIndices(14042, 200, sampleSeedKey("MMLU"));
  const b = sampleIndices(14042, 200, sampleSeedKey("MMLU"));
  assert.deepEqual(a, b);
  assert.equal(a.length, 200);
  assert.equal(new Set(a).size, 200);
  assert.ok(a.every((i) => Number.isInteger(i) && i >= 0 && i < 14042));
});

test("sampler: different seeds give different samples", () => {
  assert.notDeepEqual(sampleIndices(14042, 50, sampleSeedKey("MMLU")), sampleIndices(14042, 50, sampleSeedKey("MMLU-Pro")));
  assert.notEqual(hashString("a"), hashString("b"));
});

test("sampler: a smaller n is a stable prefix of a larger n", () => {
  const small = sampleIndices(1319, 50, "seed");
  const large = sampleIndices(1319, 300, "seed");
  assert.deepEqual(large.slice(0, 50), small);
});

test("sampler: n >= total takes every row exactly once (small datasets)", () => {
  const all = sampleIndices(161, 200, "seed");
  assert.equal(all.length, 161);
  assert.deepEqual([...all].sort((x, y) => x - y), Array.from({ length: 161 }, (_, i) => i));
  assert.deepEqual(sampleIndices(0, 10, "seed"), []);
});

test("sampler: rejects invalid sizes", () => {
  assert.throws(() => sampleIndices(-1, 5, "s"));
  assert.throws(() => sampleIndices(10, 1.5, "s"));
});

test("seededPermutation: is a permutation and deterministic", () => {
  const p = seededPermutation(4, "x");
  assert.deepEqual([...p].sort(), [0, 1, 2, 3]);
  assert.deepEqual(seededPermutation(4, "x"), p);
});

test("sampler: pinned output guards against accidental algorithm changes", () => {
  // If this fails, every stored sample changes: bump SAMPLE_SEED_VERSION and re-import.
  assert.deepEqual(sampleIndices(1000, 5, "orbbit-sample-v1:GSM8K"), [11, 292, 853, 279, 62]);
});

// --- multiple choice -------------------------------------------------------------

test("MMLU: answer index -> letter, exact prompt layout", () => {
  const q = transformMmlu({ question: "What is 2+2?", subject: "math", choices: ["3", "4", "5", "6"], answer: 1 }, ctx);
  assert.equal(q.expected_answer, "B");
  assert.equal(q.prompt, `What is 2+2?\n\nA. 3\nB. 4\nC. 5\nD. 6\n\n${MULTIPLE_CHOICE_INSTRUCTION}`);
  assert.equal(q.metadata.format, "multiple_choice");
  assert.equal(q.metadata.choices_count, 4);
  assert.equal(q.metadata.subject, "math");
});

test("MMLU: out-of-range answer fails loudly", () => {
  assert.throws(
    () => transformMmlu({ question: "Q", subject: "s", choices: ["a", "b"], answer: 3 }, ctx),
    DatasetRowError,
  );
});

test("MMLU-Pro: up to J, answer must agree with answer_index", () => {
  const options = ["o0", "o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9"];
  const row = { question_id: 70, question: "Q?", options, answer: "J", answer_index: 9, category: "law", src: "x" };
  const q = transformMmluPro(row, ctx);
  assert.equal(q.expected_answer, "J");
  assert.ok(q.prompt.includes("\nJ. o9\n"));
  assert.equal(q.metadata.choices_count, 10);
  assert.throws(() => transformMmluPro({ ...row, answer: "I" }, ctx), DatasetRowError);
});

test("ARC: numeric labels 1-4 map to letters by position", () => {
  const row = {
    id: "x1",
    question: "Which is a mammal?",
    choices: { text: ["Shark", "Whale", "Trout", "Eel"], label: ["1", "2", "3", "4"] },
    answerKey: "2",
  };
  const q = transformArc(row, ctx);
  assert.equal(q.expected_answer, "B");
  assert.ok(q.prompt.includes("A. Shark\nB. Whale\nC. Trout\nD. Eel"));
});

test("ARC: letter labels with 5 options keep upstream order", () => {
  const row = {
    id: "x2",
    question: "Q",
    choices: { text: ["a", "b", "c", "d", "e"], label: ["A", "B", "C", "D", "E"] },
    answerKey: "E",
  };
  const q = transformArc(row, ctx);
  assert.equal(q.expected_answer, "E");
  assert.equal(q.metadata.choices_count, 5);
  assert.throws(() => transformArc({ ...row, answerKey: "F" }, ctx), DatasetRowError);
});

test("HellaSwag: context + 4 endings, string label -> letter, harness cleanup", () => {
  const row = {
    activity_label: "Roof shingle removal",
    ctx_a: "A man is sitting on a roof.",
    ctx_b: "he",
    endings: ["is using wrap.", "is ripping tiles.", "holds a cube.", "starts pulling up roofing."],
    label: "3",
    source_id: "activitynet~v_x",
  };
  const q = transformHellaSwag(row, ctx);
  assert.equal(q.expected_answer, "D");
  assert.ok(q.prompt.includes("Roof shingle removal: A man is sitting on a roof. He"));
  assert.ok(q.prompt.includes("D. starts pulling up roofing."));
  assert.equal(cleanHellaSwagText("How to cook [title] Boil water [step] now"), "How to cook. Boil water now");
  assert.throws(() => transformHellaSwag({ ...row, label: "" }, ctx), DatasetRowError);
});

test("TruthfulQA mc1: correct letter follows the permuted option, never fixed at A", () => {
  const choices = ["Right answer", "Wrong 1", "Wrong 2", "Wrong 3"];
  const letters = new Set<string>();
  for (let rowIndex = 0; rowIndex < 40; rowIndex++) {
    const q = transformTruthfulQaMc1({ question: "Q?", mc1_targets: { choices, labels: [1, 0, 0, 0] } }, { rowIndex });
    const order = q.metadata.option_order as number[];
    const letterIndex = q.expected_answer.charCodeAt(0) - 65;
    assert.equal(order[letterIndex], 0, "expected letter must point at upstream index 0 (the correct choice)");
    assert.ok(q.prompt.includes(`${q.expected_answer}. Right answer`));
    letters.add(q.expected_answer);
  }
  assert.ok(letters.size > 1, "answer position must vary across rows");
  // Deterministic per row.
  const again = transformTruthfulQaMc1({ question: "Q?", mc1_targets: { choices, labels: [1, 0, 0, 0] } }, { rowIndex: 3 });
  const first = transformTruthfulQaMc1({ question: "Q?", mc1_targets: { choices, labels: [1, 0, 0, 0] } }, { rowIndex: 3 });
  assert.deepEqual(again, first);
  assert.throws(
    () => transformTruthfulQaMc1({ question: "Q", mc1_targets: { choices, labels: [1, 1, 0, 0] } }, ctx),
    DatasetRowError,
  );
});

test("WinoGrande: sentence with blank + options A/B", () => {
  const q = transformWinoGrande(
    { sentence: "Sarah was a better surgeon than Maria so _ got the easier cases.", option1: "Sarah", option2: "Maria", answer: "2" },
    ctx,
  );
  assert.equal(q.expected_answer, "B");
  assert.ok(q.prompt.includes("so _ got the easier cases.\n\nA. Sarah\nB. Maria\n\n"));
  assert.equal(q.metadata.choices_count, 2);
  assert.throws(
    () => transformWinoGrande({ sentence: "a _ b", option1: "x", option2: "y", answer: "" }, ctx),
    DatasetRowError,
  );
});

test("GPQA: correct answer placed by seeded permutation", () => {
  const row = {
    Question: "Hard Q?",
    "Correct Answer": "right",
    "Incorrect Answer 1": "w1",
    "Incorrect Answer 2": "w2",
    "Incorrect Answer 3": "w3",
  };
  const q = transformGpqa(row, ctx);
  assert.ok(q.prompt.includes(`${q.expected_answer}. right`));
  assert.equal(q.metadata.choices_count, 4);
});

// --- numeric / latex ---------------------------------------------------------

test("GSM8K: answer after ####, commas stripped", () => {
  assert.equal(extractGsm8kAnswer("She makes 9 * 2 = $<<9*2=18>>18.\n#### 18"), "18");
  assert.equal(extractGsm8kAnswer("...\n#### 1,234"), "1234");
  assert.equal(extractGsm8kAnswer("...\n#### -5"), "-5");
  assert.equal(extractGsm8kAnswer("no marker"), null);
  const q = transformGsm8k({ question: "Janet has 16 eggs...", answer: "work\n#### 18" }, ctx);
  assert.equal(q.expected_answer, "18");
  assert.equal(q.prompt, `Janet has 16 eggs...\n\n${NUMERIC_INSTRUCTION}`);
  assert.equal(q.metadata.format, "numeric");
  assert.throws(() => transformGsm8k({ question: "Q", answer: "no final" }, ctx), DatasetRowError);
});

test("MATH-500: reference answer kept verbatim, boxed instruction", () => {
  const q = transformMath500(
    {
      problem: "Convert (0,3) to polar.",
      solution: "... \\boxed{\\left( 3, \\frac{\\pi}{2} \\right)}",
      answer: "\\left( 3, \\frac{\\pi}{2} \\right)",
      subject: "Precalculus",
      level: 2,
      unique_id: "test/precalculus/807.json",
    },
    ctx,
  );
  assert.equal(q.expected_answer, "\\left( 3, \\frac{\\pi}{2} \\right)");
  assert.equal(q.prompt, `Convert (0,3) to polar.\n\n${LATEX_INSTRUCTION}`);
  assert.equal(LATEX_INSTRUCTION, "Solve step by step and put your final answer in \\boxed{}.");
  assert.equal(q.metadata.format, "latex");
  assert.equal(q.metadata.level, 2);
});

// --- code ----------------------------------------------------------------------

const multiplERow: HfRow = {
  name: "HumanEval_0_has_close_elements",
  language: "js",
  prompt: "//Check closeness\nfunction has_close_elements(numbers, threshold){\n",
  tests:
    "const assert = require('node:assert');\n\n\nfunction test() {\n  let candidate = has_close_elements;\n  assert.deepEqual(candidate([1.0, 2.0], 0.5),false);\n}\n\ntest();",
  stop_tokens: ["\nfunction ", "\n/*", "\n//", "\nconsole.log"],
};

test("MultiPL-E: JS prompt + instruction, tests/entry_point in metadata, empty expected", () => {
  const q = transformMultiplE(multiplERow, ctx);
  assert.equal(q.expected_answer, "");
  assert.equal(q.prompt, `//Check closeness\nfunction has_close_elements(numbers, threshold){\n\n${CODE_INSTRUCTION}`);
  assert.equal(q.metadata.format, "code");
  assert.equal(q.metadata.language, "javascript");
  assert.equal(q.metadata.entry_point, "has_close_elements");
  assert.equal(q.metadata.tests, multiplERow.tests);
  assert.deepEqual(q.metadata.stop_tokens, multiplERow.stop_tokens);
  assert.throws(() => transformMultiplE({ ...multiplERow, language: "py" }, ctx), DatasetRowError);
});

test("extractEntryPoint: prefers the test binding, falls back to last declared function", () => {
  assert.equal(extractEntryPoint("function a(){}\nfunction b(x){", "let candidate = b;"), "b");
  assert.equal(extractEntryPoint("function helper(){}\nfunction main(x){", "no binding"), "main");
  assert.equal(extractEntryPoint("const x = 1;", ""), null);
});

// --- open ended ----------------------------------------------------------------

test("MT-Bench: first turn only, reference when present", () => {
  const withRef = transformMtBench(
    { category: "math", prompt: ["What is 3*7?", "Now double it."], reference: ["21", "42"], prompt_id: 1 },
    ctx,
  );
  assert.equal(withRef.prompt, "What is 3*7?");
  assert.equal(withRef.expected_answer, "21");
  assert.equal(withRef.metadata.format, "open_ended");
  assert.equal(withRef.metadata.turn, 1);
  const noRef = transformMtBench({ category: "writing", prompt: ["Write a poem.", "Shorter."], reference: [], prompt_id: 2 }, ctx);
  assert.equal(noRef.expected_answer, "");
});

test("AlpacaEval: instruction + reference output", () => {
  const q = transformAlpacaEval(
    { dataset: "helpful_base", instruction: "Name Broadway actors.", output: "Hugh Jackman ...", generator: "text_davinci_003" },
    ctx,
  );
  assert.equal(q.prompt, "Name Broadway actors.");
  assert.equal(q.expected_answer, "Hugh Jackman ...");
  assert.equal(q.metadata.reference_generator, "text_davinci_003");
});

// --- configs / buildQuestion -------------------------------------------------

test("configs: benchmark names unique, unsupported ones have no config", () => {
  const names = BENCHMARK_DATASETS.map((c) => c.benchmark);
  assert.equal(new Set(names).size, names.length);
  for (const name of Object.keys(UNSUPPORTED_BENCHMARKS)) assert.equal(findDatasetConfig(name), undefined);
  assert.equal(findDatasetConfig("gsm8k")?.benchmark, "GSM8K");
});

test("buildQuestion: merges full provenance per the shared contract", () => {
  const q = buildQuestion(mustConfig("GSM8K"), { question: "Q", answer: "x\n#### 4" }, 812, 3);
  assert.deepEqual(
    {
      source: q.metadata.source,
      dataset: q.metadata.dataset,
      config: q.metadata.config,
      split: q.metadata.split,
      row_index: q.metadata.row_index,
      sample_index: q.metadata.sample_index,
      format: q.metadata.format,
      sample_seed: q.metadata.sample_seed,
    },
    {
      source: "hf",
      dataset: "openai/gsm8k",
      config: "main",
      split: "test",
      row_index: 812,
      sample_index: 3,
      format: "numeric",
      sample_seed: "orbbit-sample-v1:GSM8K",
    },
  );
  const alpaca = buildQuestion(
    mustConfig("AlpacaEval"),
    { dataset: "d", instruction: "i", output: "o", generator: "g" },
    0,
    0,
  );
  assert.equal(typeof alpaca.metadata.revision, "string");
});

test("buildSample: sample_index follows sample order", () => {
  const rows: HfRow[] = [10, 20, 30].map((n) => ({ question: `q${n}`, answer: `#### ${n}` }));
  const sample = buildSample(mustConfig("GSM8K"), [2, 0], (i) => rows[i]);
  assert.deepEqual(
    sample.map((q) => [q.metadata.sample_index, q.metadata.row_index, q.expected_answer]),
    [
      [0, 2, "30"],
      [1, 0, "10"],
    ],
  );
  assert.throws(() => buildSample(mustConfig("GSM8K"), [5], (i) => rows[i]));
});

// --- reconcile -------------------------------------------------------------------

test("planImport: idempotent, extends prefix, refuses foreign or mismatched rows", () => {
  const config = mustConfig("GSM8K");
  const rows: HfRow[] = Array.from({ length: 5 }, (_, n) => ({ question: `q${n}`, answer: `#### ${n}` }));
  const sample = buildSample(config, [4, 1, 3], (i) => rows[i]);
  const asExisting = (count: number) => sample.slice(0, count).map((q, i) => ({ id: `id${i}`, metadata: q.metadata }));

  const fresh = planImport(config, [], sample, false);
  assert.equal(fresh.action, "insert");
  assert.equal(fresh.action === "insert" && fresh.toInsert.length, 3);

  const same = planImport(config, asExisting(3), sample, false);
  assert.ok(same.action === "insert" && same.toInsert.length === 0 && same.alreadyPresent === 3);

  const grow = planImport(config, asExisting(2), sample, false);
  assert.ok(grow.action === "insert" && grow.toInsert.length === 1 && grow.toInsert[0].metadata.sample_index === 2);

  const synthetic = planImport(config, [{ id: "s", metadata: { subject: "geo" } }], sample, false);
  assert.equal(synthetic.action, "refuse");

  const drifted = planImport(config, [{ id: "d", metadata: { ...sample[0].metadata, row_index: 999 } }], sample, false);
  assert.equal(drifted.action, "refuse");

  const replace = planImport(config, [{ id: "s", metadata: {} }, ...asExisting(1)], sample, true);
  assert.ok(replace.action === "replace" && replace.deleteIds.length === 2 && replace.toInsert.length === 3);
});

// --- hf client planning (no network) -------------------------------------------

test("planRowWindows: one window per touched 100-row page, covering every index", () => {
  const windows = planRowWindows([5, 250, 7, 99, 100, 1999]);
  assert.deepEqual(windows, [
    { offset: 5, length: 95 },
    { offset: 100, length: 1 },
    { offset: 250, length: 1 },
    { offset: 1999, length: 1 },
  ]);
  assert.ok(windows.every((w) => w.length <= 100));
});

test("TruthfulQA mc1: rows with more than 10 options get letters beyond J", () => {
  const choices = Array.from({ length: 13 }, (_, i) => (i === 0 ? "True claim" : `False ${i}`));
  const labels = choices.map((_, i) => (i === 0 ? 1 : 0));
  const q = transformTruthfulQaMc1({ question: "Q?", mc1_targets: { choices, labels } }, { rowIndex: 441 });
  assert.equal(q.metadata.choices_count, 13);
  assert.ok(q.prompt.includes("\nM. "));
  assert.ok(q.prompt.includes(`${q.expected_answer}. True claim`));
});
