/**
 * Purge hand-entered ("seeded") evaluation scores — and optionally every run on the old
 * synthetic benchmark questions — from Supabase.
 *
 *   pnpm db:purge:seeded                    # dry run (default): prints what would be deleted
 *   pnpm db:purge:seeded --include-legacy   # dry run including legacy runs + synthetic questions
 *   pnpm db:purge:seeded --yes [--include-legacy]
 *
 * With --yes the script FIRST writes a full JSON backup to supabase/backups/purge-<ISO>.json
 * (evaluations + all their evaluation_results, plus the benchmark_questions when
 * --include-legacy is set), re-reads and parses it to verify, and only then deletes.
 *
 * The selection logic below is pure and unit-tested in tests/lib/purge.test.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Row shapes (only the columns the selection logic needs; backups use full rows)
// ---------------------------------------------------------------------------

export interface PurgeEvaluationRow {
  id: string;
  model_id: string;
  benchmark_id: string;
  status: string;
  accuracy: number | string | null;
  questions_evaluated: number;
  questions_correct: number;
  total_tokens: number | string | null;
  total_cost: number | string | null;
  failure_rate: number | string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PurgeResultRow {
  id: string;
  evaluation_id: string;
  question_id: string;
  judge_reasoning: string | null;
}

export interface PurgeQuestionRow {
  id: string;
  benchmark_id: string;
  metadata: unknown;
  created_at: string;
}

export interface PurgeBenchmarkRow {
  id: string;
  name: string;
  source_url: string | null;
}

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

/** Every seeding script hard-coded questions_evaluated = 500. */
export const SEEDED_QUESTIONS_EVALUATED = 500;
/** seed-all.ts / seed-frontier-evals.ts used ×240; seed-eval-runner.ts used ×250. */
export const SEEDED_TOKENS_PER_QUESTION = [240, 250] as const;
/** started_at / completed_at were two back-to-back `new Date()` calls (observed 0–1 ms apart). */
export const SEEDED_MAX_DURATION_MS = 1000;
/** Custom (BYOD) benchmarks are created with this source_url; their questions are real user data. */
export const CUSTOM_BENCHMARK_SOURCE_URL = "custom-upload";

/**
 * judge_reasoning strings written by the two fake trace generators
 * (supabase/seed-traces.ts and supabase/seed-questions.ts). No real scorer emits these.
 */
const FAKE_TRACE_PATTERNS: readonly RegExp[] = [
  /^Extracted answer matches ground truth expected solution for [\s\S]*\. Exact verification pass\.$/,
  /^Model response failed verification against ground truth\. Expected: /,
  /^Answer matches ground truth specification\.$/,
  /^Output does not match expected ground truth [\s\S]*\.$/,
];

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when an evaluation row carries the exact fingerprint of the hand-entered seed data. */
export function isSeededFingerprint(e: PurgeEvaluationRow): boolean {
  if (e.status !== "completed") return false;
  if (e.questions_evaluated !== SEEDED_QUESTIONS_EVALUATED) return false;
  if (toNumber(e.total_cost) !== 0) return false;
  if (toNumber(e.failure_rate) !== 0) return false;

  const tokens = toNumber(e.total_tokens);
  const tokenMatch = SEEDED_TOKENS_PER_QUESTION.some(
    (perQuestion) => tokens === e.questions_evaluated * perQuestion
  );
  if (!tokenMatch) return false;

  if (!e.started_at || !e.completed_at) return false;
  const started = Date.parse(e.started_at);
  const completed = Date.parse(e.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) return false;
  return Math.abs(completed - started) <= SEEDED_MAX_DURATION_MS;
}

/** True when a per-prompt result was written by one of the fake trace generators. */
export function isFakeTrace(judgeReasoning: string | null): boolean {
  if (!judgeReasoning) return false;
  return FAKE_TRACE_PATTERNS.some((pattern) => pattern.test(judgeReasoning));
}

/** True when a benchmark question came from the real Hugging Face import. */
export function isHfQuestion(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    (metadata as { source?: unknown }).source === "hf"
  );
}

/** Earliest created_at among imported (hf) questions, or null when nothing was imported yet. */
export function importCutoff(questions: readonly PurgeQuestionRow[]): string | null {
  let cutoff: number | null = null;
  for (const q of questions) {
    if (!isHfQuestion(q.metadata)) continue;
    const t = Date.parse(q.created_at);
    if (Number.isFinite(t) && (cutoff === null || t < cutoff)) cutoff = t;
  }
  return cutoff === null ? null : new Date(cutoff).toISOString();
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface SeededNeedsReview {
  evaluation: PurgeEvaluationRow;
  /** Results on this evaluation that do NOT look like fake traces. */
  unrecognizedResults: number;
}

export interface PurgeSelection {
  /** Hand-entered rows: fingerprint matches and every attached result is a fake trace. */
  seeded: PurgeEvaluationRow[];
  /** Fingerprint matches but some attached results are not recognised fake traces. Never auto-deleted. */
  seededNeedsReview: SeededNeedsReview[];
  /** (--include-legacy) Runs whose results reference synthetic (non-hf) questions. */
  legacyWithSyntheticResults: PurgeEvaluationRow[];
  /** (--include-legacy) Runs with zero results created before the hf import (failed/stalled/untraceable). */
  legacyWithoutResults: PurgeEvaluationRow[];
  /** (--include-legacy) Synthetic benchmark questions (metadata.source !== "hf"), custom benchmarks excluded. */
  legacyQuestions: PurgeQuestionRow[];
  /** created_at of the first hf question (null if none imported yet). */
  importCutoff: string | null;
}

export interface PurgeSelectionInput {
  evaluations: readonly PurgeEvaluationRow[];
  results: readonly PurgeResultRow[];
  questions: readonly PurgeQuestionRow[];
  benchmarks: readonly PurgeBenchmarkRow[];
  includeLegacy: boolean;
}

export function selectPurgeTargets(input: PurgeSelectionInput): PurgeSelection {
  const { evaluations, results, questions, benchmarks, includeLegacy } = input;

  const customBenchmarkIds = new Set(
    benchmarks.filter((b) => b.source_url === CUSTOM_BENCHMARK_SOURCE_URL).map((b) => b.id)
  );
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const resultsByEval = new Map<string, PurgeResultRow[]>();
  for (const r of results) {
    const list = resultsByEval.get(r.evaluation_id);
    if (list) list.push(r);
    else resultsByEval.set(r.evaluation_id, [r]);
  }

  const seeded: PurgeEvaluationRow[] = [];
  const seededNeedsReview: SeededNeedsReview[] = [];
  const seededIds = new Set<string>();

  for (const e of evaluations) {
    if (!isSeededFingerprint(e)) continue;
    seededIds.add(e.id);
    const attached = resultsByEval.get(e.id) ?? [];
    const unrecognized = attached.filter((r) => !isFakeTrace(r.judge_reasoning)).length;
    if (unrecognized === 0) seeded.push(e);
    else seededNeedsReview.push({ evaluation: e, unrecognizedResults: unrecognized });
  }

  const cutoff = importCutoff(questions);
  const selection: PurgeSelection = {
    seeded,
    seededNeedsReview,
    legacyWithSyntheticResults: [],
    legacyWithoutResults: [],
    legacyQuestions: [],
    importCutoff: cutoff,
  };
  if (!includeLegacy) return selection;

  const cutoffMs = cutoff === null ? null : Date.parse(cutoff);

  for (const e of evaluations) {
    if (seededIds.has(e.id)) continue;
    if (customBenchmarkIds.has(e.benchmark_id)) continue;

    const attached = resultsByEval.get(e.id) ?? [];
    if (attached.length === 0) {
      const createdBeforeImport = cutoffMs === null || Date.parse(e.created_at) < cutoffMs;
      if (createdBeforeImport) selection.legacyWithoutResults.push(e);
      continue;
    }

    const touchesSynthetic = attached.some((r) => {
      const q = questionById.get(r.question_id);
      if (!q) return false;
      return !isHfQuestion(q.metadata) && !customBenchmarkIds.has(q.benchmark_id);
    });
    if (touchesSynthetic) selection.legacyWithSyntheticResults.push(e);
  }

  selection.legacyQuestions = questions.filter(
    (q) => !isHfQuestion(q.metadata) && !customBenchmarkIds.has(q.benchmark_id)
  );

  return selection;
}

/** Evaluation ids that --yes would delete (review rows are never included). */
export function evaluationIdsToDelete(selection: PurgeSelection): string[] {
  return [
    ...selection.seeded,
    ...selection.legacyWithSyntheticResults,
    ...selection.legacyWithoutResults,
  ].map((e) => e.id);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface PurgeCliOptions {
  yes: boolean;
  includeLegacy: boolean;
  help: boolean;
}

export function parsePurgeArgs(argv: readonly string[]): PurgeCliOptions {
  const options: PurgeCliOptions = { yes: false, includeLegacy: false, help: false };
  for (const arg of argv) {
    if (arg === "--yes") options.yes = true;
    else if (arg === "--include-legacy") options.includeLegacy = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const USAGE = `Usage: pnpm db:purge:seeded [--yes] [--include-legacy]

  (no flags)         Dry run. Prints what would be deleted; writes nothing.
  --include-legacy   Also select runs on the old synthetic questions, failed/stalled runs
                     with zero results created before the HF import, and the synthetic
                     benchmark_questions themselves (custom-upload benchmarks are never touched).
  --yes              Write a verified JSON backup to supabase/backups/, then delete.`;

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

type Row = Record<string, unknown>;

async function fetchAll<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message} (${error.code})`);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchByIds(
  client: SupabaseClient,
  table: string,
  column: string,
  ids: readonly string[]
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .in(column, chunk)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to read ${table}: ${error.message} (${error.code})`);
      const page = (data ?? []) as Row[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function deleteByIds(client: SupabaseClient, table: string, ids: readonly string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { error, count } = await client.from(table).delete({ count: "exact" }).in("id", chunk);
    if (error) {
      throw new Error(
        `Delete from ${table} failed after ${deleted} rows: ${error.message} (${error.code})`
      );
    }
    deleted += count ?? 0;
  }
  return deleted;
}

function describeEvaluations(
  rows: readonly PurgeEvaluationRow[],
  modelNames: ReadonlyMap<string, string>,
  benchmarkNames: ReadonlyMap<string, string>,
  resultCounts: ReadonlyMap<string, number>,
  limit: number
): Row[] {
  return rows.slice(0, limit).map((e) => ({
    id: e.id.slice(0, 8),
    model: modelNames.get(e.model_id) ?? e.model_id,
    benchmark: benchmarkNames.get(e.benchmark_id) ?? e.benchmark_id,
    status: e.status,
    accuracy: toNumber(e.accuracy),
    n: e.questions_evaluated,
    results: resultCounts.get(e.id) ?? 0,
    created: e.created_at.slice(0, 19),
  }));
}

async function main(): Promise<void> {
  const options = parsePurgeArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run via pnpm db:purge:seeded so .env.local is loaded)."
    );
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(options.yes ? "Purge mode: --yes (backup, then DELETE)" : "Purge mode: DRY RUN (no writes)");
  console.log(`Include legacy: ${options.includeLegacy ? "yes" : "no"}\n`);

  const [evaluations, results, questions, benchmarks, models] = await Promise.all([
    fetchAll<PurgeEvaluationRow>(
      client,
      "evaluations",
      "id, model_id, benchmark_id, status, accuracy, questions_evaluated, questions_correct, total_tokens, total_cost, failure_rate, started_at, completed_at, created_at"
    ),
    fetchAll<PurgeResultRow>(client, "evaluation_results", "id, evaluation_id, question_id, judge_reasoning"),
    fetchAll<PurgeQuestionRow>(client, "benchmark_questions", "id, benchmark_id, metadata, created_at"),
    fetchAll<PurgeBenchmarkRow>(client, "benchmarks", "id, name, source_url"),
    fetchAll<{ id: string; api_identifier: string }>(client, "models", "id, api_identifier"),
  ]);

  console.log(
    `Database: ${evaluations.length} evaluations, ${results.length} evaluation_results, ${questions.length} benchmark_questions (${questions.filter((q) => isHfQuestion(q.metadata)).length} from HF import)\n`
  );

  const selection = selectPurgeTargets({
    evaluations,
    results,
    questions,
    benchmarks,
    includeLegacy: options.includeLegacy,
  });

  const modelNames = new Map(models.map((m) => [m.id, m.api_identifier]));
  const benchmarkNames = new Map(benchmarks.map((b) => [b.id, b.name]));
  const resultCounts = new Map<string, number>();
  for (const r of results) resultCounts.set(r.evaluation_id, (resultCounts.get(r.evaluation_id) ?? 0) + 1);
  const resultsOf = (rows: readonly PurgeEvaluationRow[]): number =>
    rows.reduce((sum, e) => sum + (resultCounts.get(e.id) ?? 0), 0);

  console.log("=== (1) seeded — hand-entered scores ===");
  console.log(
    `Fingerprint: status=completed, questions_evaluated=${SEEDED_QUESTIONS_EVALUATED}, total_cost=0, failure_rate=0, total_tokens=n×${SEEDED_TOKENS_PER_QUESTION.join("|")}, |completed_at−started_at| ≤ ${SEEDED_MAX_DURATION_MS}ms, all attached results are fake traces`
  );
  console.log(`Matches: ${selection.seeded.length} evaluations (${resultsOf(selection.seeded)} fake trace rows cascade)`);
  if (selection.seeded.length > 0) {
    console.table(describeEvaluations(selection.seeded, modelNames, benchmarkNames, resultCounts, 15));
    if (selection.seeded.length > 15) console.log(`... and ${selection.seeded.length - 15} more`);
  }

  if (selection.seededNeedsReview.length > 0) {
    console.log(
      `\n!!! ${selection.seededNeedsReview.length} evaluations match the seeded fingerprint but carry results that are NOT recognised fake traces. They are NOT selected; review manually:`
    );
    console.table(
      selection.seededNeedsReview.map((r) => ({
        ...describeEvaluations([r.evaluation], modelNames, benchmarkNames, resultCounts, 1)[0],
        unrecognized: r.unrecognizedResults,
      }))
    );
  } else {
    console.log("Safety check: no fingerprint match carries a result beyond the fake traces.");
  }

  if (options.includeLegacy) {
    console.log(`\n=== (2) legacy — runs on the old synthetic questions ===`);
    console.log(`HF import cutoff: ${selection.importCutoff ?? "none yet (no metadata.source=\"hf\" questions) — every zero-result run counts"}`);
    console.log(
      `Runs with results on synthetic questions: ${selection.legacyWithSyntheticResults.length} (${resultsOf(selection.legacyWithSyntheticResults)} result rows cascade)`
    );
    if (selection.legacyWithSyntheticResults.length > 0) {
      console.table(
        describeEvaluations(selection.legacyWithSyntheticResults, modelNames, benchmarkNames, resultCounts, 50)
      );
    }
    console.log(`Runs with zero results created before import: ${selection.legacyWithoutResults.length}`);
    if (selection.legacyWithoutResults.length > 0) {
      console.table(describeEvaluations(selection.legacyWithoutResults, modelNames, benchmarkNames, resultCounts, 50));
    }
    const perBenchmark = new Map<string, number>();
    for (const q of selection.legacyQuestions) {
      const name = benchmarkNames.get(q.benchmark_id) ?? q.benchmark_id;
      perBenchmark.set(name, (perBenchmark.get(name) ?? 0) + 1);
    }
    console.log(`Synthetic benchmark_questions: ${selection.legacyQuestions.length}`);
    if (perBenchmark.size > 0) {
      console.table(
        [...perBenchmark.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([benchmark, count]) => ({ benchmark, questions: count }))
      );
    }
  }

  const evalIds = evaluationIdsToDelete(selection);
  const questionIds = selection.legacyQuestions.map((q) => q.id);
  console.log(`\nTotal: ${evalIds.length} evaluations and ${questionIds.length} benchmark_questions selected.`);

  if (!options.yes) {
    console.log("\nDry run complete — nothing was written. Re-run with --yes to back up and delete.");
    return;
  }

  if (selection.seededNeedsReview.length > 0) {
    throw new Error(
      "Refusing to delete: some fingerprint matches carry unrecognised results (see above). Resolve them first."
    );
  }
  if (evalIds.length === 0 && questionIds.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  // 1. Full backup — every column of every row that will disappear (including cascades).
  const backupEvaluations = await fetchByIds(client, "evaluations", "id", evalIds);
  const backupResults = await fetchByIds(client, "evaluation_results", "evaluation_id", evalIds);
  const backupQuestions = await fetchByIds(client, "benchmark_questions", "id", questionIds);
  const cascadedQuestionResults = await fetchByIds(client, "evaluation_results", "question_id", questionIds);
  const evalIdSet = new Set(evalIds);
  const strayResults = cascadedQuestionResults.filter(
    (r) => typeof r.evaluation_id !== "string" || !evalIdSet.has(r.evaluation_id)
  );
  if (strayResults.length > 0) {
    throw new Error(
      `Refusing to delete: ${strayResults.length} evaluation_results on synthetic questions belong to evaluations that are not selected (they would cascade). Re-run the dry run.`
    );
  }
  if (backupEvaluations.length !== evalIds.length || backupQuestions.length !== questionIds.length) {
    throw new Error("Backup read returned a different row count than the selection; aborting before any delete.");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(process.cwd(), "supabase", "backups");
  const backupPath = join(backupDir, `purge-${timestamp}.json`);
  const backup = {
    created_at: new Date().toISOString(),
    options: { includeLegacy: options.includeLegacy },
    import_cutoff: selection.importCutoff,
    categories: {
      seeded: selection.seeded.map((e) => e.id),
      legacy_with_synthetic_results: selection.legacyWithSyntheticResults.map((e) => e.id),
      legacy_without_results: selection.legacyWithoutResults.map((e) => e.id),
    },
    evaluations: backupEvaluations,
    evaluation_results: backupResults,
    benchmark_questions: backupQuestions,
  };
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");

  const reread: unknown = JSON.parse(readFileSync(backupPath, "utf8"));
  const verified =
    typeof reread === "object" &&
    reread !== null &&
    Array.isArray((reread as { evaluations?: unknown }).evaluations) &&
    (reread as { evaluations: unknown[] }).evaluations.length === backupEvaluations.length &&
    Array.isArray((reread as { evaluation_results?: unknown }).evaluation_results) &&
    (reread as { evaluation_results: unknown[] }).evaluation_results.length === backupResults.length &&
    Array.isArray((reread as { benchmark_questions?: unknown }).benchmark_questions) &&
    (reread as { benchmark_questions: unknown[] }).benchmark_questions.length === backupQuestions.length;
  if (!verified) throw new Error(`Backup verification failed for ${backupPath}; nothing deleted.`);
  console.log(
    `\nBackup written and verified: ${backupPath} (${backupEvaluations.length} evaluations, ${backupResults.length} results, ${backupQuestions.length} questions)`
  );

  // 2. Delete evaluations first (evaluation_results cascade), then the synthetic questions.
  const deletedEvals = await deleteByIds(client, "evaluations", evalIds);
  console.log(`Deleted ${deletedEvals} evaluations (their evaluation_results cascaded).`);
  const deletedQuestions = await deleteByIds(client, "benchmark_questions", questionIds);
  if (questionIds.length > 0) console.log(`Deleted ${deletedQuestions} synthetic benchmark_questions.`);

  console.log("\nPurge summary");
  console.log(`  seeded evaluations deleted:          ${selection.seeded.length}`);
  if (options.includeLegacy) {
    console.log(`  legacy runs (synthetic results):     ${selection.legacyWithSyntheticResults.length}`);
    console.log(`  legacy runs (zero results):          ${selection.legacyWithoutResults.length}`);
    console.log(`  synthetic questions deleted:         ${deletedQuestions}`);
  }
  console.log(`  backup:                              ${backupPath}`);
}

if (process.argv[1]?.endsWith("purge-seeded-evaluations.ts")) {
  main().catch((err: unknown) => {
    console.error("Purge failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
