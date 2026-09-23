import type { Scorer, ScorerMetadata, ScoringContext, ScoringResult } from "../types";
import {
  OpenRouterClient,
  openRouterErrorKind,
  type OpenRouterCompletionOptions,
  type OpenRouterCompletionResult,
} from "../../openrouter/client";
import { resolveJudgeModel } from "../../openrouter/free-models";
import { preprocessResponse } from "./preprocess";
import { unscoredResult } from "./unscored";

/**
 * llm_judge — pass/fail verdict from a FREE-tier judge model on OpenRouter (rules 3 & the
 * free-only policy). Used for open-ended benchmarks (AlpacaEval, MT-Bench first turn).
 *
 * The judge sees the original instruction (ScoringContext.prompt) when the runner provides it,
 * the reference answer when the dataset has one, and an optional per-question rubric
 * (metadata.rubric). It must answer with a JSON verdict {"verdict": "pass"|"fail", "reasoning"}.
 *
 * Two kinds of reference:
 *  - a GOLD answer (MT-Bench math/reasoning/coding): PASS requires agreeing with it;
 *  - a BASELINE model output (AlpacaEval's text_davinci_003 outputs, flagged by
 *    metadata.reference_generator): it is not ground truth, so PASS means "at least as good as
 *    the baseline" — the pass rate is then a win-or-tie rate against that baseline, which is
 *    what AlpacaEval measures. Demanding agreement with a baseline would fail every correct
 *    answer to an open-ended request (poems, advice…) that is simply worded differently.
 *
 * Judge failures carry metadata.errorKind (the OpenRouter error kind) so the runner can stop
 * a run when the judge hits the shared daily free-model quota.
 *
 * There is NO heuristic fallback: if the judge call fails, times out, or returns something
 * unparseable, or if there is neither an instruction nor a reference to judge against, the
 * result is UNSCORED (metadata.unscored = true) — the runner records it and counts it in
 * failure_rate instead of inventing a score.
 */

/** The only fields of an OpenRouter completion the judge reads. */
export type JudgeCompletion = Pick<OpenRouterCompletionResult, "text" | "latencyMs">;

/** Minimal client surface (OpenRouterClient satisfies it); injectable for tests. */
export interface JudgeClient {
  createChatCompletion(options: OpenRouterCompletionOptions): Promise<JudgeCompletion>;
}

interface JudgeVerdict {
  pass: boolean;
  reasoning: string;
}

const MAX_FIELD_CHARS = 12_000;
/**
 * Every current free judge model is a reasoning model; its hidden reasoning counts against
 * max_tokens, so a small budget ends mid-thought with no verdict (→ unscored).
 */
export const JUDGE_MAX_TOKENS = 4096;

type ReferenceKind = "gold" | "baseline";

function clip(text: string): string {
  return text.length > MAX_FIELD_CHARS ? `${text.slice(0, MAX_FIELD_CHARS)}\n[…truncated]` : text;
}

function verdictFromValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "pass" || v === "passed" || v === "correct" || v === "yes") return true;
  if (v === "fail" || v === "failed" || v === "incorrect" || v === "no") return false;
  return null;
}

/** Parses the judge's reply: a JSON object with "verdict" (preferred) or a bare "VERDICT: PASS" line. */
export function parseJudgeVerdict(rawText: string): JudgeVerdict | null {
  const text = preprocessResponse(rawText).replace(/```(?:json)?/gi, "");

  const objects = text.match(/\{[\s\S]*?\}/g) ?? [];
  for (let i = objects.length - 1; i >= 0; i--) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(objects[i]);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const record = parsed as Record<string, unknown>;
    const pass = verdictFromValue(record.verdict ?? record.isCorrect ?? record.pass);
    if (pass === null) continue;
    const reasoning =
      typeof record.reasoning === "string" && record.reasoning.trim() ? record.reasoning.trim() : "No reasoning given.";
    return { pass, reasoning };
  }

  const line = text.match(/verdict\W{0,5}(pass|fail)\b/i);
  if (line) return { pass: line[1].toLowerCase() === "pass", reasoning: text.slice(0, 500).trim() };
  return null;
}

function referenceRule(reference: string, kind: ReferenceKind): string {
  if (!reference) {
    return "- There is no reference answer. PASS only if the response correctly, completely and helpfully fulfils the instruction with no factual errors, fabrications or refusals of a benign request.";
  }
  if (kind === "baseline") {
    return "- The baseline response is another model's attempt, NOT a gold answer. PASS only if the model response fulfils the instruction at least as well as the baseline (correctness first, then completeness and helpfulness). FAIL if it is worse than the baseline, contains factual errors, or refuses a benign request.";
  }
  return "- PASS only if the response is consistent with the reference answer on every essential point (it may be worded differently or add correct detail). Any factual contradiction of the reference, a wrong final answer, or a missing essential part is a FAIL.";
}

function buildJudgePrompt(
  instruction: string,
  reference: string,
  referenceKind: ReferenceKind,
  candidate: string,
  rubric: string
): string {
  const sections: string[] = [
    "You are grading one response from an AI model in a benchmark. Decide whether it PASSES or FAILS.",
  ];
  if (instruction) sections.push(`[INSTRUCTION GIVEN TO THE MODEL]\n${clip(instruction)}`);
  if (reference) {
    sections.push(
      referenceKind === "baseline"
        ? `[BASELINE RESPONSE FROM ANOTHER MODEL]\n${clip(reference)}`
        : `[REFERENCE ANSWER]\n${clip(reference)}`
    );
  }
  if (rubric) sections.push(`[RUBRIC]\n${clip(rubric)}`);
  sections.push(`[MODEL RESPONSE]\n${clip(candidate)}`);
  sections.push(
    [
      "Grading rules:",
      referenceRule(reference, referenceKind),
      "- Ignore length, style and formatting unless the instruction requires them.",
      "- Be strict: when in doubt, FAIL.",
      "",
      'Reply with ONLY this JSON object and nothing else: {"verdict": "pass" | "fail", "reasoning": "<one or two sentences>"}',
    ].join("\n")
  );
  return sections.join("\n\n");
}

export class LLMJudgeScorer implements Scorer {
  name = "llm_judge";
  private readonly judgeModel: string;
  private readonly client: JudgeClient;

  constructor(judgeModel?: string, client?: JudgeClient) {
    // Judge calls must stay on the free tier as well.
    this.judgeModel = resolveJudgeModel(judgeModel ?? process.env.JUDGE_MODEL);
    this.client = client ?? new OpenRouterClient();
  }

  async score(
    response: string,
    expected: string,
    metadata?: ScorerMetadata,
    context?: ScoringContext
  ): Promise<ScoringResult> {
    const candidate = preprocessResponse(response);
    const reference = (expected ?? "").trim();
    const instruction = (context?.prompt ?? "").trim();
    const rubric = typeof metadata?.rubric === "string" ? metadata.rubric.trim() : "";
    const referenceKind: ReferenceKind =
      typeof metadata?.reference_generator === "string" && metadata.reference_generator.trim() ? "baseline" : "gold";
    const judgeMeta = { judgeModel: this.judgeModel };

    if (!candidate) {
      // A blank answer is a real miss, not a grading failure.
      return { isCorrect: false, score: 0, reasoning: "Empty response.", metadata: judgeMeta };
    }
    if (!instruction && !reference) {
      return unscoredResult("Nothing to judge against: no instruction or reference answer was provided.", judgeMeta);
    }

    let rawVerdict: string;
    let judgeLatencyMs: number;
    try {
      const judgeResponse = await this.client.createChatCompletion({
        model: this.judgeModel,
        messages: [
          { role: "system", content: "You are a strict, impartial evaluation judge. Output only the requested JSON." },
          { role: "user", content: buildJudgePrompt(instruction, reference, referenceKind, candidate, rubric) },
        ],
        temperature: 0,
        max_tokens: JUDGE_MAX_TOKENS,
      });
      rawVerdict = judgeResponse.text;
      judgeLatencyMs = judgeResponse.latencyMs;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return unscoredResult(`Judge unavailable (${this.judgeModel}): ${message}`, {
        ...judgeMeta,
        judgeError: message,
        errorKind: openRouterErrorKind(err),
      });
    }

    const verdict = parseJudgeVerdict(rawVerdict);
    if (!verdict) {
      return unscoredResult(`Judge (${this.judgeModel}) returned no parseable verdict.`, {
        ...judgeMeta,
        judgeRaw: rawVerdict.slice(0, 500),
      });
    }

    return {
      isCorrect: verdict.pass,
      score: verdict.pass ? 1 : 0,
      reasoning: `[Judge ${this.judgeModel}: ${verdict.pass ? "PASS" : "FAIL"}] ${verdict.reasoning}`,
      metadata: {
        ...judgeMeta,
        judgeLatencyMs,
        usedReference: reference.length > 0,
        referenceKind: reference.length > 0 ? referenceKind : null,
        usedInstruction: instruction.length > 0,
      },
    };
  }
}
