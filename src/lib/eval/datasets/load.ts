/**
 * Loads a benchmark's deterministic sample from Hugging Face and builds
 * contract-conformant questions. Network reads only; writes nothing.
 */
import { buildQuestion } from "./configs";
import { fetchRawJsonRows, fetchRowsByIndex, fetchSplitSize, type HfClientOptions } from "./hf-client";
import type { RowCache } from "./row-cache";
import { sampleIndices, sampleSeedKey } from "./sampler";
import type { BenchmarkDatasetConfig, HfRow, ImportedQuestion } from "./types";

export interface LoadedSample {
  /** Rows in the upstream split. */
  total: number;
  questions: ImportedQuestion[];
}

export function buildSample(
  config: BenchmarkDatasetConfig,
  indices: readonly number[],
  rowAt: (rowIndex: number) => HfRow | undefined,
): ImportedQuestion[] {
  return indices.map((rowIndex, sampleIndex) => {
    const row = rowAt(rowIndex);
    if (!row) throw new Error(`${config.benchmark}: row ${rowIndex} missing from fetched data`);
    return buildQuestion(config, row, rowIndex, sampleIndex);
  });
}

export async function loadBenchmarkSample(
  config: BenchmarkDatasetConfig,
  n: number,
  options: HfClientOptions,
  cache?: RowCache,
): Promise<LoadedSample> {
  const seedKey = sampleSeedKey(config.benchmark);
  const { source } = config;

  if (source.kind === "raw-json-file") {
    const rows = await fetchRawJsonRows(source, options);
    const indices = sampleIndices(rows.length, n, seedKey);
    return { total: rows.length, questions: buildSample(config, indices, (i) => rows[i]) };
  }

  const total = await fetchSplitSize(source, options);
  const indices = sampleIndices(total, n, seedKey);
  const rows = cache ? await cache.load(source) : new Map<number, HfRow>();
  const missing = indices.filter((i) => !rows.has(i));
  if (missing.length > 0) {
    try {
      await fetchRowsByIndex(source, missing, options, rows);
    } finally {
      // Keep whatever arrived (even on failure) so a re-run only fetches the rest.
      await cache?.save(source, rows);
    }
  }
  return { total, questions: buildSample(config, indices, (i) => rows.get(i)) };
}
