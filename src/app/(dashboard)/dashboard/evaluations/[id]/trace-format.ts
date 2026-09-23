/**
 * Server-side shaping of prompt-level traces for the drill-down. Question metadata can be bulky
 * (test suites, seeds, dataset provenance), so it is reduced here to exactly what the client
 * renders: the display chips and the reference the response was graded against.
 */
import type { EvaluationResultItem } from "./evaluation-drilldown";

export interface TraceQuestion {
  prompt: string;
  expected_answer: string;
  metadata: Record<string, unknown> | null;
}

/** An evaluation_results row with its joined benchmark question, as selected by the page. */
export interface TraceRow {
  id: string;
  is_correct: boolean;
  score: number | string | null;
  latency_ms: number | null;
  tokens_used: number | null;
  time_to_first_token_ms: number | null;
  model_response: string | null;
  judge_reasoning: string | null;
  created_at: string | null;
  benchmark_questions: TraceQuestion | TraceQuestion[] | null;
}

/** Metadata that is bulky or internal; shown elsewhere (tests) or not useful as a chip. */
const HIDDEN_METADATA_KEYS = new Set(["tests", "sample_seed", "revision", "format", "source"]);
const MAX_CHIP_CHARS = 80;

/** Short primitive metadata values (e.g. subject, dataset, row index) as display chips. */
function metadataEntries(metadata: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!metadata) return [];
  return Object.entries(metadata).flatMap(([key, value]): Array<[string, string]> => {
    if (HIDDEN_METADATA_KEYS.has(key)) return [];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return [];
    const text = String(value);
    return text.length > MAX_CHIP_CHARS ? [] : [[key.replace(/_/g, " "), text]];
  });
}

/** What the response was graded against, by question format. */
function referenceFor(q: TraceQuestion | null): { label: string; body: string } {
  if (!q) return { label: "Expected answer", body: "—" };
  const meta = q.metadata ?? {};
  if (meta.format === "code" && typeof meta.tests === "string") {
    return { label: "Tests executed in the sandbox (pass@1)", body: meta.tests };
  }
  if (typeof meta.reference_generator === "string" && q.expected_answer) {
    return { label: `Baseline response (${meta.reference_generator}) — the judge checks the answer is at least as good`, body: q.expected_answer };
  }
  if (meta.format === "open_ended" && !q.expected_answer) {
    return { label: "Expected answer", body: "(No reference answer — the LLM judge grades the response against the instruction.)" };
  }
  return { label: "Expected answer", body: q.expected_answer || "—" };
}

/** Maps a DB row to the trimmed shape the client drill-down renders and searches. */
export function toTraceItem(row: TraceRow): EvaluationResultItem {
  const q = Array.isArray(row.benchmark_questions)
    ? (row.benchmark_questions[0] ?? null)
    : row.benchmark_questions;
  const reference = referenceFor(q);
  const score = row.score === null ? null : Number(row.score);
  return {
    id: row.id,
    is_correct: row.is_correct,
    score: score !== null && Number.isFinite(score) ? score : null,
    latency_ms: row.latency_ms,
    tokens_used: row.tokens_used,
    time_to_first_token_ms: row.time_to_first_token_ms,
    model_response: row.model_response,
    judge_reasoning: row.judge_reasoning,
    reference,
    question: q
      ? {
          prompt: q.prompt,
          chips: metadataEntries(q.metadata),
          // The expected answer is searchable; send it only when the reference doesn't already carry it.
          ...(q.expected_answer === reference.body ? {} : { expected_answer: q.expected_answer }),
        }
      : null,
  };
}
