/**
 * Conservative final-answer normalization for MATH-style (LaTeX) answers.
 *
 * What it does: extracts the LAST `\boxed{…}` with balanced-brace parsing, strips purely
 * presentational LaTeX (\left, \right, spacing commands, \text{} wrappers, degree/percent/dollar
 * signs, trailing periods, a leading "x=" when the reference has none), canonicalizes
 * \dfrac/\tfrac → \frac and \frac12 → \frac{1}{2}, then compares string-equal — or numerically
 * when both sides are plain numbers or simple fractions.
 *
 * Known limitations (deliberate — a false "correct" is worse than a false "incorrect"):
 *   - No symbolic equivalence: "\frac{\sqrt{2}}{2}" ≠ "\frac{1}{\sqrt{2}}", "x+1" ≠ "1+x",
 *     "2\pi" ≠ "\pi\cdot2".
 *   - Intervals/tuples/sets compare as strings after normalization ("(1,2)" vs "(1, 2)" match;
 *     reordered set elements do not).
 *   - Only numeric forms: integers, decimals, a/b, \frac{a}{b} (optionally negative).
 *   - Units are only removed when written as a trailing "\text{ unit}" (leading space), mirroring
 *     the Hendrycks MATH reference normalizer.
 */

const BOXED_COMMAND_RE = /\\(?:boxed|fbox)/g;

/** Content of the brace group starting at `open` (which must be "{"), or null if unbalanced. */
function readBraceGroup(text: string, open: number): { content: string; end: number } | null {
  if (text[open] !== "{") return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++; // skip escaped char: "\{" / "\}" are literal braces, not grouping
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { content: text.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** Content of the LAST well-formed `\boxed{…}` / `\fbox{…}` (nested braces supported), or null. */
export function extractLastBoxed(text: string): string | null {
  const starts: number[] = [];
  BOXED_COMMAND_RE.lastIndex = 0;
  for (let m = BOXED_COMMAND_RE.exec(text); m !== null; m = BOXED_COMMAND_RE.exec(text)) {
    starts.push(m.index + m[0].length);
  }
  for (let k = starts.length - 1; k >= 0; k--) {
    let i = starts[k];
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] === "{") {
      const group = readBraceGroup(text, i);
      if (group) return group.content.trim();
      continue;
    }
    // "\boxed 5" (no braces): a single token.
    const token = text.slice(i).match(/^[^\s$]+/);
    if (token && starts[k] !== i) return token[0].replace(/[.,]$/, "");
  }
  return null;
}

/** Rewrites "\frac12" → "\frac{1}{2}" and "\sqrt2" → "\sqrt{2}" (single-char, brace-less arguments). */
function fixBracelessArgs(s: string): string {
  const out = s.replace(/\\sqrt(?![a-zA-Z{\[])\s*([^\s{\\])/g, "\\sqrt{$1}");
  let result = "";
  let i = 0;
  while (i < out.length) {
    if (!out.startsWith("\\frac", i)) {
      result += out[i];
      i++;
      continue;
    }
    result += "\\frac";
    i += 5;
    for (let arg = 0; arg < 2 && i < out.length; arg++) {
      if (out[i] === "{") {
        const group = readBraceGroup(out, i);
        if (!group) break;
        result += `{${fixBracelessArgs(group.content)}}`;
        i = group.end;
      } else if (out[i] === "\\") {
        break; // command argument like \frac\pi2 — leave untouched
      } else {
        result += `{${out[i]}}`;
        i++;
      }
    }
  }
  return result;
}

function unwrapTextCommands(s: string): string {
  let prev: string;
  let out = s;
  do {
    prev = out;
    out = out.replace(/\\(?:text|textbf|textit|textrm|mathrm|mathbf|mathit|mbox|operatorname)\s*\{([^{}]*)\}/g, "$1");
  } while (out !== prev);
  return out;
}

export interface LatexNormalizeOptions {
  /** Remove a leading single-variable assignment such as "x=" or "\theta =". */
  stripVariablePrefix?: boolean;
}

/** Canonical string form of a LaTeX final answer (see module doc for the exact rules). */
export function normalizeLatexAnswer(raw: string, options: LatexNormalizeOptions = {}): string {
  let s = raw.trim();

  // Surrounding math delimiters.
  s = s.replace(/^\$+|\$+$/g, "").replace(/^\\\(|\\\)$/g, "").replace(/^\\\[|\\\]$/g, "").trim();

  // A fully boxed reference answer.
  if (/^\\(?:boxed|fbox)\s*\{/.test(s)) {
    const inner = extractLastBoxed(s);
    if (inner !== null) s = inner;
  }

  s = s.replace(/\\[dt]frac(?![a-zA-Z])/g, "\\frac");
  s = s.replace(/\\left(?![a-zA-Z])/g, "").replace(/\\right(?![a-zA-Z])/g, "");
  s = s.replace(/\\displaystyle(?![a-zA-Z])/g, "");
  s = s.replace(/\\q?quad(?![a-zA-Z])/g, "").replace(/\\[!,;: ]/g, "").replace(/~/g, "");

  // Trailing units written as "\text{ cm}" (leading space inside), as in the Hendrycks normalizer.
  const unitIdx = s.search(/\\(?:text|mbox|mathrm)\{\s/);
  if (unitIdx > 0) s = s.slice(0, unitIdx);

  s = unwrapTextCommands(s);

  // Degrees, percent, currency.
  s = s.replace(/\^\s*\{\s*\\circ\s*\}/g, "").replace(/\^\s*\\circ/g, "").replace(/\\circ/g, "").replace(/°/g, "");
  s = s.replace(/\\%/g, "").replace(/%/g, "").replace(/\\\$/g, "").replace(/\$/g, "");

  // Thousands separators: "10{,}000" always; "1,000,000" only when the whole answer is such a number.
  s = s.replace(/\{,\}/g, "");
  s = s.replace(/\s+/g, "");
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) s = s.replace(/,/g, "");

  s = s.replace(/\.+$/, "");
  s = fixBracelessArgs(s);

  if (options.stripVariablePrefix) {
    const assign = s.match(/^(?:[a-zA-Z]|\\[a-zA-Z]+)=(.+)$/);
    if (assign && !assign[1].includes("=")) s = assign[1];
  }

  // ".5" → "0.5"
  s = s.replace(/(^|[^\d])\.(\d)/g, "$10.$2");
  return s;
}

/** Numeric value of an already-normalized answer when it is a plain number or simple fraction. */
export function parseSimpleNumber(normalized: string): number | null {
  const s = normalized.replace(/^\+/, "");
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);

  const frac = s.match(/^(-?)\\frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}$/);
  if (frac) {
    const den = Number(frac[3]);
    if (den === 0) return null;
    return (frac[1] === "-" ? -1 : 1) * (Number(frac[2]) / den);
  }

  const slash = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (slash) {
    const den = Number(slash[2]);
    if (den === 0) return null;
    return Number(slash[1]) / den;
  }
  return null;
}

export function numbersEquivalent(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
}

/** True when the candidate LaTeX answer matches the reference after normalization. */
export function latexAnswersEquivalent(candidate: string, reference: string): boolean {
  const ref = normalizeLatexAnswer(reference);
  const refHasPrefix = /^(?:[a-zA-Z]|\\[a-zA-Z]+)=/.test(ref);
  const cand = normalizeLatexAnswer(candidate, { stripVariablePrefix: !refHasPrefix });
  if (cand.length === 0 || ref.length === 0) return false;
  if (cand === ref) return true;

  const a = parseSimpleNumber(cand);
  const b = parseSimpleNumber(ref);
  return a !== null && b !== null && numbersEquivalent(a, b);
}
