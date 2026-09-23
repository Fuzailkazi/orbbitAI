/**
 * Pure row -> question transformers. One per upstream dataset schema.
 *
 * They implement the shared data contract formats exactly. Options keep their
 * upstream order, except where the upstream order itself reveals the answer
 * (TruthfulQA mc1 always lists the correct answer first; GPQA stores it in a
 * separate column) - there a deterministic per-row permutation is applied and
 * recorded in metadata.option_order so the mapping stays auditable.
 */
import { seededPermutation } from "./sampler";
import { DatasetRowError, type HfRow, type TransformContext, type TransformedQuestion } from "./types";

export const MULTIPLE_CHOICE_INSTRUCTION = "Answer with the letter of the correct option only, in the form: Answer: X";
export const NUMERIC_INSTRUCTION =
  "Solve step by step, then give the final answer on its own line in the form: Answer: <number>";
export const LATEX_INSTRUCTION = "Solve step by step and put your final answer in \\boxed{}.";
export const CODE_INSTRUCTION =
  "Complete this JavaScript function. Reply with the full function in a single ```javascript code block and nothing else.";

// MMLU-Pro uses up to J; TruthfulQA mc1 has up to 13 options (A..M).
export const OPTION_LETTERS: readonly string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// --- field helpers -----------------------------------------------------------

function fail(ctx: TransformContext, message: string): never {
  throw new DatasetRowError(`row ${ctx.rowIndex}: ${message}`);
}

function str(row: HfRow, key: string, ctx: TransformContext): string {
  const value = row[key];
  if (typeof value !== "string") fail(ctx, `expected string field "${key}", got ${typeof value}`);
  return value;
}

function nonEmptyStr(row: HfRow, key: string, ctx: TransformContext): string {
  const value = str(row, key, ctx).trim();
  if (value === "") fail(ctx, `field "${key}" is empty`);
  return value;
}

function int(row: HfRow, key: string, ctx: TransformContext): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) fail(ctx, `expected integer field "${key}"`);
  return value;
}

function strArray(value: unknown, label: string, ctx: TransformContext): string[] {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string")) {
    fail(ctx, `expected string[] for "${label}"`);
  }
  return value;
}

function record(value: unknown, label: string, ctx: TransformContext): HfRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(ctx, `expected object for "${label}"`);
  return value as HfRow;
}

function letterAt(index: number, ctx: TransformContext): string {
  const letter = OPTION_LETTERS[index];
  if (letter === undefined) fail(ctx, `option index ${index} has no letter (max ${OPTION_LETTERS.length})`);
  return letter;
}

// --- format builders ---------------------------------------------------------

/**
 * Multiple-choice prompt: question, blank line, "A. ..." options, blank line, instruction.
 * `correctIndex` is the 0-based index into `options` as presented.
 */
export function buildMultipleChoice(
  question: string,
  options: string[],
  correctIndex: number,
  ctx: TransformContext,
  extra: Record<string, unknown> = {},
): TransformedQuestion {
  if (options.length < 2) fail(ctx, `need at least 2 options, got ${options.length}`);
  if (options.length > OPTION_LETTERS.length) fail(ctx, `too many options (${options.length})`);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    fail(ctx, `correct index ${correctIndex} out of range for ${options.length} options`);
  }
  const optionLines = options.map((option, i) => `${letterAt(i, ctx)}. ${option.trim()}`).join("\n");
  return {
    prompt: `${question.trim()}\n\n${optionLines}\n\n${MULTIPLE_CHOICE_INSTRUCTION}`,
    expected_answer: letterAt(correctIndex, ctx),
    metadata: { format: "multiple_choice", choices_count: options.length, ...extra },
  };
}

// --- multiple choice datasets --------------------------------------------------

/** cais/mmlu: { question, subject, choices: string[4], answer: 0-3 } */
export function transformMmlu(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const choices = strArray(row.choices, "choices", ctx);
  return buildMultipleChoice(nonEmptyStr(row, "question", ctx), choices, int(row, "answer", ctx), ctx, {
    subject: str(row, "subject", ctx),
  });
}

/** TIGER-Lab/MMLU-Pro: { question_id, question, options: string[<=10], answer: "A".."J", answer_index, category, src } */
export function transformMmluPro(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const options = strArray(row.options, "options", ctx);
  const answerIndex = int(row, "answer_index", ctx);
  const answer = str(row, "answer", ctx).trim();
  if (letterAt(answerIndex, ctx) !== answer) fail(ctx, `answer "${answer}" disagrees with answer_index ${answerIndex}`);
  return buildMultipleChoice(nonEmptyStr(row, "question", ctx), options, answerIndex, ctx, {
    category: str(row, "category", ctx),
    upstream_question_id: int(row, "question_id", ctx),
    upstream_src: str(row, "src", ctx),
  });
}

/** allenai/ai2_arc: { id, question, choices: { text[], label[] }, answerKey } - labels are "A".."E" or "1".."5". */
export function transformArc(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const choices = record(row.choices, "choices", ctx);
  const texts = strArray(choices.text, "choices.text", ctx);
  const labels = strArray(choices.label, "choices.label", ctx);
  if (texts.length !== labels.length) fail(ctx, "choices.text and choices.label lengths differ");
  const answerKey = str(row, "answerKey", ctx).trim();
  const correctIndex = labels.findIndex((label) => label.trim() === answerKey);
  if (correctIndex === -1) fail(ctx, `answerKey "${answerKey}" not among labels ${labels.join(",")}`);
  return buildMultipleChoice(nonEmptyStr(row, "question", ctx), texts, correctIndex, ctx, {
    upstream_id: str(row, "id", ctx),
    upstream_labels: labels,
  });
}

/** Same cleanup lm-evaluation-harness applies to HellaSwag's WikiHow text. */
export function cleanHellaSwagText(text: string): string {
  return text.trim().replace(/ \[title\]/g, ". ").replace(/\[.*?\]/g, "").replace(/ {2}/g, " ");
}

/** Rowan/hellaswag: { activity_label, ctx_a, ctx_b, endings: string[4], label: "0".."3" } */
export function transformHellaSwag(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const endings = strArray(row.endings, "endings", ctx).map(cleanHellaSwagText);
  const labelRaw = str(row, "label", ctx).trim();
  if (!/^\d+$/.test(labelRaw)) fail(ctx, `label "${labelRaw}" is not an index (unlabeled split?)`);
  const ctxB = str(row, "ctx_b", ctx);
  const context = cleanHellaSwagText(`${str(row, "ctx_a", ctx)} ${ctxB.charAt(0).toUpperCase()}${ctxB.slice(1)}`);
  const activity = cleanHellaSwagText(str(row, "activity_label", ctx));
  const question = `Which ending is the most plausible continuation of the following text?\n\n${activity}: ${context}`;
  return buildMultipleChoice(question, endings, Number(labelRaw), ctx, {
    activity_label: activity,
    upstream_source_id: typeof row.source_id === "string" ? row.source_id : null,
  });
}

/**
 * truthfulqa/truthful_qa (multiple_choice): { question, mc1_targets: { choices[], labels[] } }.
 * Upstream always lists the single correct choice first, so presenting the upstream
 * order would let "always answer A" score 100%. Options are permuted per row with a
 * fixed seed; metadata.option_order[i] is the upstream index shown at letter i.
 */
export function transformTruthfulQaMc1(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const targets = record(row.mc1_targets, "mc1_targets", ctx);
  const choices = strArray(targets.choices, "mc1_targets.choices", ctx);
  const labels = targets.labels;
  if (!Array.isArray(labels) || labels.length !== choices.length) fail(ctx, "mc1_targets.labels malformed");
  const correctUpstream = labels.flatMap((label, i) => (label === 1 ? [i] : []));
  if (correctUpstream.length !== 1) fail(ctx, `mc1 must have exactly one correct choice, got ${correctUpstream.length}`);
  const order = seededPermutation(choices.length, `truthfulqa-mc1:${ctx.rowIndex}`);
  const options = order.map((i) => choices[i]);
  return buildMultipleChoice(nonEmptyStr(row, "question", ctx), options, order.indexOf(correctUpstream[0]), ctx, {
    option_order: order,
  });
}

/** allenai/winogrande: { sentence (with "_"), option1, option2, answer: "1" | "2" } */
export function transformWinoGrande(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const answer = str(row, "answer", ctx).trim();
  if (answer !== "1" && answer !== "2") fail(ctx, `answer "${answer}" must be "1" or "2" (unlabeled split?)`);
  const sentence = nonEmptyStr(row, "sentence", ctx);
  if (!sentence.includes("_")) fail(ctx, "sentence has no blank (_)");
  const question = `Which option correctly fills the blank (_) in the following sentence?\n\n${sentence}`;
  return buildMultipleChoice(
    question,
    [nonEmptyStr(row, "option1", ctx), nonEmptyStr(row, "option2", ctx)],
    answer === "1" ? 0 : 1,
    ctx,
  );
}

/**
 * Idavidrein/gpqa (gated): { Question, "Correct Answer", "Incorrect Answer 1..3" }.
 * The correct answer is its own column, so the four options are permuted per row
 * with a fixed seed (option_order[i] = 0 means the correct answer is at letter i).
 * Field names follow the published dataset card; they could not be verified
 * without an HF_TOKEN, so any mismatch fails loudly here rather than importing junk.
 */
export function transformGpqa(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const answers = [
    nonEmptyStr(row, "Correct Answer", ctx),
    nonEmptyStr(row, "Incorrect Answer 1", ctx),
    nonEmptyStr(row, "Incorrect Answer 2", ctx),
    nonEmptyStr(row, "Incorrect Answer 3", ctx),
  ];
  const order = seededPermutation(answers.length, `gpqa:${ctx.rowIndex}`);
  return buildMultipleChoice(
    nonEmptyStr(row, "Question", ctx),
    order.map((i) => answers[i]),
    order.indexOf(0),
    ctx,
    { option_order: order },
  );
}

// --- numeric / latex ---------------------------------------------------------

/** GSM8K final answer: the text after "####", commas stripped. */
export function extractGsm8kAnswer(solution: string): string | null {
  const marker = solution.lastIndexOf("####");
  if (marker === -1) return null;
  const answer = solution.slice(marker + 4).trim().replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(answer) ? answer : null;
}

/** openai/gsm8k (main): { question, answer: "...\n#### 18" } */
export function transformGsm8k(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const solution = str(row, "answer", ctx);
  const expected = extractGsm8kAnswer(solution);
  if (expected === null) fail(ctx, "could not find a numeric answer after ####");
  return {
    prompt: `${nonEmptyStr(row, "question", ctx)}\n\n${NUMERIC_INSTRUCTION}`,
    expected_answer: expected,
    metadata: { format: "numeric" },
  };
}

/** HuggingFaceH4/MATH-500: { problem, solution, answer, subject, level, unique_id } */
export function transformMath500(row: HfRow, ctx: TransformContext): TransformedQuestion {
  return {
    prompt: `${nonEmptyStr(row, "problem", ctx)}\n\n${LATEX_INSTRUCTION}`,
    expected_answer: nonEmptyStr(row, "answer", ctx),
    metadata: {
      format: "latex",
      subject: str(row, "subject", ctx),
      level: int(row, "level", ctx),
      upstream_id: str(row, "unique_id", ctx),
    },
  };
}

// --- code --------------------------------------------------------------------

/** Name of the function under test: MultiPL-E tests bind it as `let candidate = name;`. */
export function extractEntryPoint(prompt: string, tests: string): string | null {
  const fromTests = /let\s+candidate\s*=\s*([A-Za-z_$][\w$]*)\s*;/.exec(tests);
  if (fromTests) return fromTests[1];
  const declarations = [...prompt.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
  return declarations.length > 0 ? declarations[declarations.length - 1][1] : null;
}

/** nuprl/MultiPL-E (humaneval-js / mbpp-js): { name, language, prompt, tests, stop_tokens } */
export function transformMultiplE(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const language = str(row, "language", ctx);
  if (language !== "js") fail(ctx, `expected language "js", got "${language}"`);
  const jsPrompt = str(row, "prompt", ctx).trimEnd();
  if (jsPrompt === "") fail(ctx, "prompt is empty");
  const tests = nonEmptyStr(row, "tests", ctx);
  const entryPoint = extractEntryPoint(jsPrompt, tests);
  if (entryPoint === null) fail(ctx, "could not determine the entry point function name");
  const stopTokens = Array.isArray(row.stop_tokens) ? strArray(row.stop_tokens, "stop_tokens", ctx) : undefined;
  return {
    prompt: `${jsPrompt}\n\n${CODE_INSTRUCTION}`,
    expected_answer: "",
    metadata: {
      format: "code",
      language: "javascript",
      entry_point: entryPoint,
      tests,
      ...(stopTokens ? { stop_tokens: stopTokens } : {}),
      upstream_name: str(row, "name", ctx),
    },
  };
}

// --- open ended (LLM judge) --------------------------------------------------

/** HuggingFaceH4/mt_bench_prompts: { category, prompt: string[2], reference: string[], prompt_id }. First turn only. */
export function transformMtBench(row: HfRow, ctx: TransformContext): TransformedQuestion {
  const turns = strArray(row.prompt, "prompt", ctx);
  const firstTurn = turns[0]?.trim();
  if (!firstTurn) fail(ctx, "no first-turn prompt");
  const references = Array.isArray(row.reference) ? strArray(row.reference, "reference", ctx) : [];
  return {
    prompt: firstTurn,
    expected_answer: references[0]?.trim() ?? "",
    metadata: {
      format: "open_ended",
      category: str(row, "category", ctx),
      turn: 1,
      upstream_prompt_id: int(row, "prompt_id", ctx),
    },
  };
}

/** tatsu-lab/alpaca_eval (alpaca_eval.json): { instruction, output, generator, dataset } */
export function transformAlpacaEval(row: HfRow, ctx: TransformContext): TransformedQuestion {
  return {
    prompt: nonEmptyStr(row, "instruction", ctx),
    expected_answer: str(row, "output", ctx).trim(),
    metadata: {
      format: "open_ended",
      reference_generator: str(row, "generator", ctx),
      subset: str(row, "dataset", ctx),
    },
  };
}
