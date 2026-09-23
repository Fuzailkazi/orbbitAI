import type { Scorer, ScorerMetadata, ScoringResult } from "../types";
import { preprocessResponse } from "./preprocess";
import { unscoredResult } from "./unscored";
import { DEFAULT_SANDBOX_TIMEOUT_MS, runJavaScriptTests, type SandboxResult } from "../sandbox/run-javascript";

/**
 * pass_at_k — functional correctness by EXECUTION (pass@1, one sample per question).
 *
 * Questions come from MultiPL-E's JavaScript ports (humaneval-js, mbpp-js). The model is asked
 * for the full function in a ```javascript block; we extract that code, run it followed by the
 * question's MultiPL-E `tests` string in the sandbox (../sandbox/run-javascript.ts), and the
 * answer passes only if the tests complete without throwing.
 *
 * `metadata.stop_tokens` is intentionally ignored: MultiPL-E uses stop tokens to truncate raw
 * completions, whereas Orbbit grades full-function chat responses where helper functions after
 * the entry point (which the stop tokens would cut off) are legitimate.
 *
 * Not a verdict (unscored): the question has no tests, declares a non-JavaScript language, or
 * the sandbox itself could not run.
 */

const JS_LANGS = new Set(["javascript", "js", "jsx", "mjs", "cjs", "node", "nodejs"]);

interface CodeBlock {
  lang: string;
  body: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fencedBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```[ \t]*([A-Za-z0-9_+#.-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    blocks.push({ lang: m[1].toLowerCase(), body: m[2] });
    if (m[0].length === 0) re.lastIndex++;
  }
  return blocks;
}

function definesEntryPoint(code: string, entryPoint: string): boolean {
  if (!entryPoint) return false;
  const name = escapeRegExp(entryPoint);
  return new RegExp(
    `\\bfunction\\s*\\*?\\s*${name}\\s*\\(|\\b(?:const|let|var)\\s+${name}\\s*=|(?:^|[^.\\w$])${name}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`
  ).test(code);
}

function pickBlock(blocks: CodeBlock[], entryPoint: string): CodeBlock | undefined {
  const withEntry = blocks.filter((b) => definesEntryPoint(b.body, entryPoint));
  return withEntry[withEntry.length - 1] ?? blocks[blocks.length - 1];
}

/** ES-module `export` keywords are not valid in the sandbox's script context; drop them. */
function stripExports(code: string): string {
  return code.replace(/^(\s*)export\s+(?:default\s+)?(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/gm, "$1");
}

/**
 * The code to execute: the JavaScript fenced block defining the entry point (else the last
 * JavaScript block, else the last unlabelled block, else the last block of any language), or
 * the whole response when it has no fences.
 */
export function extractJavaScript(response: string, entryPoint = ""): string {
  const text = preprocessResponse(response);
  const blocks = fencedBlocks(text);
  if (blocks.length === 0) return stripExports(text).trim();

  const chosen =
    pickBlock(
      blocks.filter((b) => JS_LANGS.has(b.lang)),
      entryPoint
    ) ??
    pickBlock(
      blocks.filter((b) => b.lang === ""),
      entryPoint
    ) ??
    pickBlock(blocks, entryPoint);
  return stripExports(chosen?.body ?? "").trim();
}

function describeFailure(result: SandboxResult): string {
  if (result.status === "timeout") return `Timed out: ${result.message ?? "execution limit exceeded"}`;
  const where = result.phase === "candidate" ? "while loading the candidate code" : "while running the tests";
  const error = [result.errorName, result.message].filter(Boolean).join(": ");
  return `Failed ${where}${error ? ` — ${error}` : ""}`;
}

export interface PassAtKOptions {
  /** Per-question sandbox wall-clock budget in ms (default 5000). */
  timeoutMs?: number;
}

export class PassAtKScorer implements Scorer {
  name = "pass_at_k";
  private readonly timeoutMs: number;

  constructor(options: PassAtKOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS;
  }

  async score(response: string, _expected: string, metadata?: ScorerMetadata): Promise<ScoringResult> {
    const tests = typeof metadata?.tests === "string" ? metadata.tests : "";
    if (!tests.trim()) {
      return unscoredResult("Question has no executable tests in its metadata; cannot run pass@1.");
    }

    const language = typeof metadata?.language === "string" ? metadata.language.trim().toLowerCase() : "javascript";
    if (!JS_LANGS.has(language)) {
      return unscoredResult(`Language "${language}" is not supported by the sandbox (JavaScript only).`, {
        language,
      });
    }

    const entryPoint = typeof metadata?.entry_point === "string" ? metadata.entry_point.trim() : "";
    const code = extractJavaScript(response, entryPoint);
    if (!code) {
      return {
        isCorrect: false,
        score: 0,
        reasoning: "No code found in the response.",
        metadata: { k: 1, language: "javascript", sandbox: "not_run" },
      };
    }

    const result = await runJavaScriptTests(code, tests, { timeoutMs: this.timeoutMs });
    const details = {
      k: 1,
      language: "javascript",
      sandbox: result.status,
      phase: result.phase ?? null,
      errorName: result.errorName ?? null,
      durationMs: result.durationMs,
    };

    if (result.status === "error") {
      return unscoredResult(`Sandbox could not run the tests: ${result.message ?? "unknown error"}`, details);
    }
    if (result.status === "passed") {
      return {
        isCorrect: true,
        score: 1,
        reasoning: `All tests passed${entryPoint ? ` for ${entryPoint}` : ""} (${result.durationMs}ms).`,
        metadata: details,
      };
    }
    return { isCorrect: false, score: 0, reasoning: describeFailure(result), metadata: details };
  }
}
