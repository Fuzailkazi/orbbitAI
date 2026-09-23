/**
 * Benchmark -> upstream dataset mapping. Every id/config/split/field below was
 * checked against the live HF datasets-server (/splits and /rows), except GPQA,
 * which is gated and only imports when HF_TOKEN is set.
 */
import { sampleSeedKey } from "./sampler";
import {
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
} from "./transformers";
import type { BenchmarkDatasetConfig, HfRow, ImportedQuestion } from "./types";

export const DEFAULT_SAMPLE_SIZE = 200;

export const BENCHMARK_DATASETS: readonly BenchmarkDatasetConfig[] = [
  {
    benchmark: "MMLU",
    source: { kind: "datasets-server", dataset: "cais/mmlu", config: "all", split: "test" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformMmlu,
  },
  {
    benchmark: "MMLU-Pro",
    source: { kind: "datasets-server", dataset: "TIGER-Lab/MMLU-Pro", config: "default", split: "test" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformMmluPro,
  },
  {
    benchmark: "GSM8K",
    source: { kind: "datasets-server", dataset: "openai/gsm8k", config: "main", split: "test" },
    format: "numeric",
    scoringMethod: "normalized_match",
    transform: transformGsm8k,
  },
  {
    benchmark: "MATH",
    source: { kind: "datasets-server", dataset: "HuggingFaceH4/MATH-500", config: "default", split: "test" },
    format: "latex",
    scoringMethod: "normalized_match",
    transform: transformMath500,
    notes: "MATH-500: the standard 500-problem subset of the MATH test set.",
  },
  {
    benchmark: "ARC-Challenge",
    source: { kind: "datasets-server", dataset: "allenai/ai2_arc", config: "ARC-Challenge", split: "test" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformArc,
  },
  {
    benchmark: "ARC-Easy",
    source: { kind: "datasets-server", dataset: "allenai/ai2_arc", config: "ARC-Easy", split: "test" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformArc,
  },
  {
    benchmark: "HellaSwag",
    source: { kind: "datasets-server", dataset: "Rowan/hellaswag", config: "default", split: "validation" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformHellaSwag,
    notes: "Validation split: the test split's labels are hidden.",
  },
  {
    benchmark: "TruthfulQA",
    source: { kind: "datasets-server", dataset: "truthfulqa/truthful_qa", config: "multiple_choice", split: "validation" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformTruthfulQaMc1,
    notes: "mc1 targets; options permuted per row (upstream always lists the correct one first).",
  },
  {
    benchmark: "WinoGrande",
    source: { kind: "datasets-server", dataset: "allenai/winogrande", config: "winogrande_xl", split: "validation" },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformWinoGrande,
    notes: "Validation split: the test split's labels are hidden.",
  },
  {
    benchmark: "GPQA",
    source: { kind: "datasets-server", dataset: "Idavidrein/gpqa", config: "gpqa_diamond", split: "train", gated: true },
    format: "multiple_choice",
    scoringMethod: "exact_match",
    transform: transformGpqa,
    notes: "Gated: requires HF_TOKEN with accepted terms. Skipped otherwise.",
  },
  {
    benchmark: "HumanEval",
    source: { kind: "datasets-server", dataset: "nuprl/MultiPL-E", config: "humaneval-js", split: "test" },
    format: "code",
    scoringMethod: "pass_at_k",
    transform: transformMultiplE,
    notes: "MultiPL-E JavaScript port of HumanEval (161 problems).",
  },
  {
    benchmark: "MBPP",
    source: { kind: "datasets-server", dataset: "nuprl/MultiPL-E", config: "mbpp-js", split: "test" },
    format: "code",
    scoringMethod: "pass_at_k",
    transform: transformMultiplE,
    notes: "MultiPL-E JavaScript port of MBPP (397 problems).",
  },
  {
    benchmark: "MT-Bench",
    source: { kind: "datasets-server", dataset: "HuggingFaceH4/mt_bench_prompts", config: "default", split: "train" },
    format: "open_ended",
    scoringMethod: "llm_judge",
    transform: transformMtBench,
    notes: "First turn only; reference answers exist for math/reasoning/coding categories.",
  },
  {
    benchmark: "AlpacaEval",
    source: {
      kind: "raw-json-file",
      dataset: "tatsu-lab/alpaca_eval",
      config: "alpaca_eval",
      split: "eval",
      revision: "2edc6fad8be6b14ea7230aabfd08188da6b8b814",
      path: "alpaca_eval.json",
    },
    format: "open_ended",
    scoringMethod: "llm_judge",
    transform: transformAlpacaEval,
    notes: "Script-based repo (no datasets-server); raw alpaca_eval.json pinned to a commit. Reference = text_davinci_003 output.",
  },
];

/** Benchmarks deliberately left without questions until a faithful automatic scorer exists. */
export const UNSUPPORTED_BENCHMARKS: Readonly<Record<string, string>> = {
  IFEval: "Needs programmatic instruction-constraint verifiers (not exact match).",
  DROP: "Needs DROP's span/number F1 scorer (not a single exact answer).",
  LiveCodeBench: "Needs a sandboxed multi-language stdin/stdout judge with hidden tests.",
  BBH: "Mixed free-form/option targets across 27 tasks; no clean single-format subset wired up yet.",
};

export function findDatasetConfig(benchmark: string): BenchmarkDatasetConfig | undefined {
  return BENCHMARK_DATASETS.find((config) => config.benchmark.toLowerCase() === benchmark.toLowerCase());
}

/** Pure: build one contract-conformant question from an upstream row. */
export function buildQuestion(
  config: BenchmarkDatasetConfig,
  row: HfRow,
  rowIndex: number,
  sampleIndex: number,
): ImportedQuestion {
  const transformed = config.transform(row, { rowIndex });
  if (transformed.metadata.format !== config.format) {
    throw new Error(`${config.benchmark}: transformer produced format ${transformed.metadata.format}, expected ${config.format}`);
  }
  const { source } = config;
  return {
    prompt: transformed.prompt,
    expected_answer: transformed.expected_answer,
    metadata: {
      ...transformed.metadata,
      format: config.format,
      source: "hf",
      dataset: source.dataset,
      config: source.config,
      split: source.split,
      row_index: rowIndex,
      sample_index: sampleIndex,
      sample_seed: sampleSeedKey(config.benchmark),
      ...(source.kind === "raw-json-file" ? { revision: source.revision } : {}),
    },
  };
}
