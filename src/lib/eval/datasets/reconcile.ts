/**
 * Pure planning step for the importer: given the questions a benchmark already
 * has and the freshly built sample, decide what (if anything) to write.
 */
import type { BenchmarkDatasetConfig, ImportedQuestion } from "./types";
import { sampleSeedKey } from "./sampler";

export interface ExistingQuestion {
  id: string;
  metadata: unknown;
}

export type ImportPlan =
  | { action: "insert"; toInsert: ImportedQuestion[]; alreadyPresent: number }
  | { action: "replace"; deleteIds: string[]; toInsert: ImportedQuestion[] }
  | { action: "refuse"; reason: string };

interface ExistingSampleRow {
  id: string;
  rowIndex: number;
  sampleIndex: number;
}

function asImportedRow(config: BenchmarkDatasetConfig, q: ExistingQuestion): ExistingSampleRow | null {
  const m = q.metadata;
  if (typeof m !== "object" || m === null) return null;
  const meta = m as Record<string, unknown>;
  const { source } = config;
  if (meta.source !== "hf" || meta.dataset !== source.dataset || meta.config !== source.config || meta.split !== source.split) {
    return null;
  }
  if (meta.sample_seed !== sampleSeedKey(config.benchmark)) return null;
  if (!Number.isInteger(meta.row_index) || !Number.isInteger(meta.sample_index)) return null;
  return { id: q.id, rowIndex: meta.row_index as number, sampleIndex: meta.sample_index as number };
}

export function planImport(
  config: BenchmarkDatasetConfig,
  existing: readonly ExistingQuestion[],
  sample: readonly ImportedQuestion[],
  replace: boolean,
): ImportPlan {
  if (replace) {
    return { action: "replace", deleteIds: existing.map((q) => q.id), toInsert: [...sample] };
  }

  const imported: ExistingSampleRow[] = [];
  let foreign = 0;
  for (const q of existing) {
    const row = asImportedRow(config, q);
    if (row) imported.push(row);
    else foreign++;
  }
  if (foreign > 0) {
    return {
      action: "refuse",
      reason: `${foreign} existing question(s) are not from this dataset sample (e.g. old synthetic seed rows). Re-run with --replace.`,
    };
  }

  const bySampleIndex = new Map<number, ExistingSampleRow>();
  for (const row of imported) {
    if (bySampleIndex.has(row.sampleIndex)) {
      return { action: "refuse", reason: `duplicate sample_index ${row.sampleIndex} in existing questions. Re-run with --replace.` };
    }
    bySampleIndex.set(row.sampleIndex, row);
  }

  for (const q of sample) {
    const present = bySampleIndex.get(q.metadata.sample_index);
    if (present && present.rowIndex !== q.metadata.row_index) {
      return {
        action: "refuse",
        reason: `sample_index ${q.metadata.sample_index} maps to row ${present.rowIndex} in the database but row ${q.metadata.row_index} now (upstream changed?). Re-run with --replace.`,
      };
    }
  }

  const toInsert = sample.filter((q) => !bySampleIndex.has(q.metadata.sample_index));
  return { action: "insert", toInsert, alreadyPresent: sample.length - toInsert.length };
}
