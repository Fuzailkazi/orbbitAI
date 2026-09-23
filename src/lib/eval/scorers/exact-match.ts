import type { Scorer, ScorerMetadata, ScoringResult } from "../types";
import { preprocessResponse } from "./preprocess";

/**
 * exact_match — multiple-choice letter extraction (MMLU, MMLU-Pro, ARC, HellaSwag, TruthfulQA
 * mc1, WinoGrande, GPQA). Expected answer is a single uppercase letter; the valid range is
 * A..letter(metadata.choices_count).
 *
 * Extraction tiers (the first tier that yields a valid letter wins; within a tier the LAST
 * occurrence wins, because models restate their final choice at the end):
 *   1. Explicit answer statements: "Answer: X", "the answer is (X)", "**Answer:** X",
 *      "correct option is X", "\boxed{X}", "the answer is definitely X."
 *   2. A bold letter: "**X**", "**(X)**".
 *   3. The whole response is just the letter ("C", "(C)", "c.").
 *   4. The last standalone "(X)".
 *   5. A single-line response that starts with an option label ("C. Canberra", "B) Merge sort").
 * Letters are never matched inside words, and lowercase letters are only accepted where they
 * cannot be an English word ("Answer: c", "(c)", a lone "c") — so "the answer is a tricky one"
 * does not yield "A". If nothing is extractable the response is a real miss (not unscored).
 *
 * Benchmarks whose expected answer is free text (custom BYOD benchmarks) fall back to a strict
 * normalized string equality.
 */

const MAX_CHOICES = 26;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type ExtractionMethod = "answer_statement" | "bold_letter" | "lone_letter" | "leading_label" | "parenthesized";

interface Candidate {
  letter: string;
  index: number;
}

/** "answer"-style keyword followed by separators, ending exactly at the candidate letter. */
const ANSWER_STATEMENT_RE =
  /\b(?:final\s+answer|answer|correct\s+(?:option|choice|letter)|final\s+choice)\b(?:\s*(?:\*\*|__))?\s*(?:is|would\s+be|should\s+be|[:：=])?(?:\s*(?:\*\*|__))?\s*[:：]?(?:\s*(?:\*\*|__))?\s*(?:(?:option|choice|letter)\s*)?([([]\s*)?([A-Za-z])/gi;

/** "the answer is definitely C." — an uppercase letter closing the answer sentence. */
const ANSWER_SENTENCE_END_RE =
  /\b(?:[Aa]nswer|ANSWER)\b[^\n.]{0,40}?[^A-Za-z0-9'’]([A-Z])(?=[\s*_)\].!]*(?:\n|$))/g;

const BOXED_LETTER_RE = /\\boxed\s*\{\s*(?:\\text(?:bf)?\s*\{\s*)?\(?\s*([A-Za-z])\s*\)?\s*\}/g;
const BOLD_LETTER_RE = /(?:\*\*|__)\s*\(?([A-Z])\)?[.:]?\s*(?:\*\*|__)/g;
const LONE_LETTER_RE = /^[\s*_`"'([]*([A-Za-z])[\s*_`"')\].:]*$/;
const LEADING_LABEL_RE = /^[\s*_]*\(?([A-Z])[.):](?:\s|$)/;
const PARENTHESIZED_RE = /\(([A-Z])\)/g;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9'’]/.test(ch);
}

function answerStatementCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  /** [start, end) of each accepted explicit statement ("Answer: B"). */
  const statementSpans: Array<[number, number]> = [];
  ANSWER_STATEMENT_RE.lastIndex = 0;
  for (let m = ANSWER_STATEMENT_RE.exec(text); m !== null; m = ANSWER_STATEMENT_RE.exec(text)) {
    const letter = m[2];
    const after = text.slice(ANSWER_STATEMENT_RE.lastIndex);
    const bracketed = Boolean(m[1]) && /^\s*[)\]]/.test(after);
    if (!bracketed && isWordChar(after[0])) continue;
    // A lowercase letter is only an answer when nothing word-like follows ("answer: c." / "answer is c,").
    if (letter !== letter.toUpperCase() && !bracketed && !/^\s*(?:[.,;:!?*)\]]|$)/.test(after)) continue;
    // "Answer: I think it's B" — the pronoun, not option I.
    if (letter === "I" && !bracketed && /^\s+[a-z]/.test(after)) continue;
    out.push({ letter: letter.toUpperCase(), index: m.index });
    statementSpans.push([m.index, ANSWER_STATEMENT_RE.lastIndex]);
  }

  // "the answer is definitely C." — only where no explicit statement already covers that
  // "answer" keyword, so "The answer is B, not C." stays B.
  ANSWER_SENTENCE_END_RE.lastIndex = 0;
  for (let m = ANSWER_SENTENCE_END_RE.exec(text); m !== null; m = ANSWER_SENTENCE_END_RE.exec(text)) {
    const start = m.index;
    if (statementSpans.some(([s, e]) => start >= s && start < e)) continue;
    out.push({ letter: m[1], index: m.index });
  }

  BOXED_LETTER_RE.lastIndex = 0;
  for (let m = BOXED_LETTER_RE.exec(text); m !== null; m = BOXED_LETTER_RE.exec(text)) {
    out.push({ letter: m[1].toUpperCase(), index: m.index });
  }
  return out;
}

function globalCandidates(re: RegExp, text: string): Candidate[] {
  const out: Candidate[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    out.push({ letter: m[1].toUpperCase(), index: m.index });
  }
  return out;
}

function lastValid(candidates: Candidate[], choicesCount: number): string | null {
  let best: Candidate | null = null;
  for (const c of candidates) {
    const pos = LETTERS.indexOf(c.letter);
    if (pos < 0 || pos >= choicesCount) continue;
    if (!best || c.index >= best.index) best = c;
  }
  return best?.letter ?? null;
}

/** Extracts the chosen option letter from an already-preprocessed response, or null. */
export function extractChoiceLetter(
  text: string,
  choicesCount: number
): { letter: string; method: ExtractionMethod } | null {
  const tier1 = lastValid(answerStatementCandidates(text), choicesCount);
  if (tier1) return { letter: tier1, method: "answer_statement" };

  const tier2 = lastValid(globalCandidates(BOLD_LETTER_RE, text), choicesCount);
  if (tier2) return { letter: tier2, method: "bold_letter" };

  const lone = text.match(LONE_LETTER_RE);
  if (lone) {
    const letter = lastValid([{ letter: lone[1].toUpperCase(), index: 0 }], choicesCount);
    if (letter) return { letter, method: "lone_letter" };
  }

  const parenthesized = lastValid(globalCandidates(PARENTHESIZED_RE, text), choicesCount);
  if (parenthesized) return { letter: parenthesized, method: "parenthesized" };

  // Only when nothing later in the text names an option: "(A) is wrong, (B) is wrong, so (D)."
  // must not be read as A.
  if (!text.includes("\n")) {
    const leading = text.match(LEADING_LABEL_RE);
    if (leading) {
      const letter = lastValid([{ letter: leading[1], index: 0 }], choicesCount);
      if (letter) return { letter, method: "leading_label" };
    }
  }

  return null;
}

/** A–(choices_count). Missing/invalid metadata defaults to 4 choices, widened to cover the expected letter. */
export function resolveChoicesCount(expectedLetter: string, metadata?: ScorerMetadata): number {
  const expectedCount = LETTERS.indexOf(expectedLetter) + 1;
  const raw = metadata?.choices_count;
  const declared =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 2 && raw <= MAX_CHOICES ? raw : 4;
  return Math.max(declared, expectedCount);
}

function normalizeFreeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(?:the\s+)?(?:final\s+)?answer\s*(?:is|:)\s*/i, "")
    .replace(/[\s.,!?;:"'`*]+/g, " ")
    .trim();
}

export class ExactMatchScorer implements Scorer {
  name = "exact_match";

  score(response: string, expected: string, metadata?: ScorerMetadata): ScoringResult {
    const text = preprocessResponse(response);
    const expectedLetter = expected.trim().toUpperCase();

    if (!/^[A-Z]$/.test(expectedLetter)) {
      const isCorrect = text.length > 0 && normalizeFreeText(text) === normalizeFreeText(expected);
      return {
        isCorrect,
        score: isCorrect ? 1 : 0,
        reasoning: isCorrect
          ? "Normalized response matches the expected answer."
          : "Normalized response does not match the expected answer.",
      };
    }

    const choicesCount = resolveChoicesCount(expectedLetter, metadata);
    const extracted = extractChoiceLetter(text, choicesCount);
    if (!extracted) {
      return {
        isCorrect: false,
        score: 0,
        reasoning: `No answer letter found (valid options A-${LETTERS[choicesCount - 1]}); expected ${expectedLetter}.`,
        metadata: { extracted: null },
      };
    }

    const isCorrect = extracted.letter === expectedLetter;
    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      reasoning: `Extracted option ${extracted.letter} (${extracted.method.replace(/_/g, " ")}); expected ${expectedLetter}.`,
      metadata: { extracted: extracted.letter, method: extracted.method },
    };
  }
}
