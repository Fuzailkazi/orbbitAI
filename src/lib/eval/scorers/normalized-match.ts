import type { Scorer, ScorerMetadata, ScoringResult } from "../types";
import { preprocessResponse } from "./preprocess";
import { extractLastBoxed, latexAnswersEquivalent, numbersEquivalent } from "./latex";
import { unscoredResult } from "./unscored";

/**
 * normalized_match — final-answer comparison after normalization.
 *
 * Two modes, chosen by the question's `metadata.format` (declared by the importer):
 *  - "numeric" (GSM8K): the answer is the number on the last "Answer: N" line, else the last
 *    "#### N", else the last \boxed{N}, else the last number in the response. Commas, "$",
 *    "%" and trailing units are ignored; comparison is numeric with a 1e-6 relative tolerance.
 *  - "latex" (MATH-500): the answer is the LAST \boxed{…} (balanced braces), else a final
 *    "Answer: …" line. Both sides are normalized conservatively and compared as strings, or
 *    numerically when both are plain numbers/simple fractions. No symbolic equivalence — see
 *    ./latex.ts for the exact rules and known limitations.
 * Legacy questions without `format` use numeric mode when the reference is a plain number,
 * latex mode otherwise.
 */

type MatchMode = "numeric" | "latex";

interface NumberToken {
  value: number;
  raw: string;
}

const NUMBER_SOURCE = String.raw`([-−]?)\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)`;

function toNumber(sign: string, digits: string): number {
  const value = Number(digits.replace(/,/g, ""));
  return sign ? -value : value;
}

/** All numbers in `text`, in order. A "-" directly after a digit/letter/")" is subtraction, not a sign. */
export function findNumbers(text: string): NumberToken[] {
  const re = new RegExp(NUMBER_SOURCE, "g");
  const out: NumberToken[] = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const before = text[m.index - 1];
    let sign = m[1];
    if (!sign && before !== undefined && /[\d.]/.test(before)) continue; // tail of another token (e.g. "3.1.4")
    if (sign) {
      // "10-3", "x-3", "10 - 3", "(a) - 3" are subtraction; "to -5", "= -5", "(-5" are negatives.
      const touching = before !== undefined && /[A-Za-z0-9)\]]/.test(before);
      const spacedOperand = /[0-9)\]]/.test(text.slice(0, m.index).trimEnd().slice(-1));
      if (touching || spacedOperand) sign = "";
    }
    const value = toNumber(sign, m[2]);
    if (Number.isFinite(value)) out.push({ value, raw: m[0].trim() });
  }
  return out;
}

const ANSWER_LINE_NUMBER_RE = new RegExp(
  String.raw`\banswer\b\s*(?:\*\*|__)?\s*(?:is\b\s*[:：]?|[:：=])\s*(?:\*\*|__)?\s*(?:\\boxed\{\s*)?` + NUMBER_SOURCE,
  "gi"
);
const GSM_DELIMITER_RE = new RegExp(String.raw`####\s*` + NUMBER_SOURCE, "g");

function lastMatchNumber(re: RegExp, text: string): number | null {
  let last: number | null = null;
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const value = toNumber(m[1], m[2]);
    if (Number.isFinite(value)) last = value;
  }
  return last;
}

/** The model's final numeric answer and where it came from, or null. */
export function extractNumericAnswer(text: string): { value: number; source: string } | null {
  const fromAnswerLine = lastMatchNumber(ANSWER_LINE_NUMBER_RE, text);
  if (fromAnswerLine !== null) return { value: fromAnswerLine, source: "answer line" };

  const fromDelimiter = lastMatchNumber(GSM_DELIMITER_RE, text);
  if (fromDelimiter !== null) return { value: fromDelimiter, source: "#### delimiter" };

  const boxed = extractLastBoxed(text);
  if (boxed !== null) {
    const nums = findNumbers(boxed.replace(/\\[!,;: ]|\{,\}/g, ""));
    if (nums.length === 1) return { value: nums[0].value, source: "\\boxed{}" };
  }

  const all = findNumbers(text);
  if (all.length > 0) return { value: all[all.length - 1].value, source: "last number" };
  return null;
}

/** Parses a canonical reference number ("1,234", "$18", "-3.5"). */
function parseReferenceNumber(expected: string): number | null {
  const cleaned = expected.trim().replace(/[$,%\s]/g, "").replace(/\.$/, "").replace(/^−/, "-");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  return Number(cleaned);
}

const ANSWER_LINE_TEXT_RE = /\b(?:final\s+)?answer\b\s*(?:is\s*)?(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*([^\n]+)/gi;

/** The model's final LaTeX answer: last \boxed{…}, else the last "Answer: …" line. */
export function extractLatexAnswer(text: string): { value: string; source: string } | null {
  const boxed = extractLastBoxed(text);
  if (boxed !== null && boxed.length > 0) return { value: boxed, source: "\\boxed{}" };

  let last: string | null = null;
  ANSWER_LINE_TEXT_RE.lastIndex = 0;
  for (let m = ANSWER_LINE_TEXT_RE.exec(text); m !== null; m = ANSWER_LINE_TEXT_RE.exec(text)) {
    last = m[1].replace(/(?:\*\*|__)\s*$/, "").trim();
  }
  return last ? { value: last, source: "answer line" } : null;
}

function resolveMode(expected: string, metadata?: ScorerMetadata): MatchMode {
  if (metadata?.format === "numeric") return "numeric";
  if (metadata?.format === "latex") return "latex";
  return parseReferenceNumber(expected) !== null ? "numeric" : "latex";
}

export class NormalizedMatchScorer implements Scorer {
  name = "normalized_match";

  score(response: string, expected: string, metadata?: ScorerMetadata): ScoringResult {
    const text = preprocessResponse(response);
    const mode = resolveMode(expected, metadata);
    return mode === "numeric" ? this.scoreNumeric(text, expected) : this.scoreLatex(text, expected);
  }

  private scoreNumeric(text: string, expected: string): ScoringResult {
    const reference = parseReferenceNumber(expected);
    if (reference === null) {
      return unscoredResult(`Reference answer "${expected}" is not a number; cannot grade numerically.`, {
        mode: "numeric",
      });
    }

    const extracted = extractNumericAnswer(text);
    if (!extracted) {
      return {
        isCorrect: false,
        score: 0,
        reasoning: `No numeric answer found; expected ${reference}.`,
        metadata: { mode: "numeric", extracted: null },
      };
    }

    const isCorrect = numbersEquivalent(extracted.value, reference);
    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      reasoning: `Extracted ${extracted.value} from ${extracted.source}; expected ${reference}.`,
      metadata: { mode: "numeric", extracted: extracted.value, source: extracted.source },
    };
  }

  private scoreLatex(text: string, expected: string): ScoringResult {
    if (!expected.trim()) {
      return unscoredResult("Question has no reference answer; cannot grade.", { mode: "latex" });
    }

    const extracted = extractLatexAnswer(text);
    if (!extracted) {
      return {
        isCorrect: false,
        score: 0,
        reasoning: `No \\boxed{} final answer found; expected ${expected.trim()}.`,
        metadata: { mode: "latex", extracted: null },
      };
    }

    const isCorrect = latexAnswersEquivalent(extracted.value, expected);
    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      reasoning: `Extracted "${extracted.value}" from ${extracted.source}; expected "${expected.trim()}"${
        isCorrect ? " (equivalent after normalization)." : " (not equivalent after normalization)."
      }`,
      metadata: { mode: "latex", extracted: extracted.value, source: extracted.source },
    };
  }
}
