/**
 * Types for importing real benchmark questions from public Hugging Face datasets.
 *
 * Every imported question follows the shared data contract:
 *   { benchmark_id, prompt, expected_answer, metadata }
 * where metadata always carries provenance (source/dataset/config/split/row_index)
 * and the question's position in Orbbit's fixed deterministic sample (sample_index).
 */

/** One upstream dataset row as returned by the HF datasets-server (JSON object). */
export type HfRow = Record<string, unknown>;

export type QuestionFormat = "multiple_choice" | "numeric" | "latex" | "code" | "open_ended";

/** Provenance fields every imported question carries in its metadata. */
export interface QuestionProvenance {
  source: "hf";
  dataset: string;
  config: string;
  split: string;
  row_index: number;
  sample_index: number;
  /** Seed key used by the deterministic sampler (lets anyone reproduce the sample). */
  sample_seed: string;
  /** Pinned upstream revision, when the source supports pinning (raw files). */
  revision?: string;
}

export type QuestionMetadata = QuestionProvenance & {
  format: QuestionFormat;
} & Record<string, unknown>;

/** What a transformer produces for one row (provenance is merged in by buildQuestion). */
export interface TransformedQuestion {
  prompt: string;
  expected_answer: string;
  metadata: { format: QuestionFormat } & Record<string, unknown>;
}

/** A fully built row, ready to insert once the benchmark_id is known. */
export interface ImportedQuestion {
  prompt: string;
  expected_answer: string;
  metadata: QuestionMetadata;
}

/** Context passed to transformers (row identity only; they stay pure). */
export interface TransformContext {
  rowIndex: number;
}

export type RowTransformer = (row: HfRow, ctx: TransformContext) => TransformedQuestion;

/** Rows served through the datasets-server /rows API. */
export interface DatasetsServerSource {
  kind: "datasets-server";
  dataset: string;
  config: string;
  split: string;
  /** Gated datasets need HF_TOKEN (and accepted terms on huggingface.co). */
  gated?: boolean;
}

/**
 * A raw JSON array file in a dataset repo, for datasets the viewer cannot serve
 * (e.g. script-based repos). Pinned to a commit so the sample never drifts.
 */
export interface RawJsonFileSource {
  kind: "raw-json-file";
  dataset: string;
  /** Logical config/split names recorded in metadata. */
  config: string;
  split: string;
  revision: string;
  path: string;
}

export type DatasetSource = DatasetsServerSource | RawJsonFileSource;

export interface BenchmarkDatasetConfig {
  /** Must match benchmarks.name in the database exactly. */
  benchmark: string;
  source: DatasetSource;
  format: QuestionFormat;
  /** Scoring method the benchmark row must declare (rule 10). Checked by the importer. */
  scoringMethod: "exact_match" | "normalized_match" | "pass_at_k" | "llm_judge";
  transform: RowTransformer;
  notes?: string;
}

export class DatasetRowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetRowError";
  }
}
