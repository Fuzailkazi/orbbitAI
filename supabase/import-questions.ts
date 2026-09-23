/**
 * Imports REAL benchmark questions from public Hugging Face datasets.
 *
 *   pnpm db:import:questions                              # dry run, all supported benchmarks
 *   pnpm db:import:questions --benchmarks MMLU,GSM8K --n 50
 *   pnpm db:import:questions --write                      # insert (idempotent)
 *   pnpm db:import:questions --write --replace            # replace a benchmark's questions
 *   (add --no-cache to bypass the local row cache in the OS temp dir)
 *
 * Dry run is the default: it fetches and transforms the sample, prints counts and
 * two sample prompts per benchmark, and (if Supabase env vars are present) shows
 * what a write would do, using read-only queries. Nothing is written without --write.
 *
 * --replace refuses for any benchmark whose existing questions are referenced by
 * evaluation_results (deleting them would cascade-delete those traces): run
 * `pnpm db:purge:seeded` first.
 *
 * Seeding script: uses the service role key (the documented exception to rule 4).
 */
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BENCHMARK_DATASETS, DEFAULT_SAMPLE_SIZE, UNSUPPORTED_BENCHMARKS, findDatasetConfig } from "../src/lib/eval/datasets/configs";
import { loadBenchmarkSample } from "../src/lib/eval/datasets/load";
import { createFileRowCache, DEFAULT_ROW_CACHE_DIR, type RowCache } from "../src/lib/eval/datasets/row-cache";
import { planImport, type ExistingQuestion, type ImportPlan } from "../src/lib/eval/datasets/reconcile";
import type { BenchmarkDatasetConfig, ImportedQuestion } from "../src/lib/eval/datasets/types";

const CHUNK = 100;
const PAGE = 1000;

interface CliOptions {
  benchmarks: BenchmarkDatasetConfig[];
  n: number;
  write: boolean;
  replace: boolean;
  cache: RowCache | undefined;
}

type Outcome = { benchmark: string; status: "ok" | "skipped" | "refused" | "failed"; detail: string };

function usage(): string {
  return [
    "Usage: pnpm db:import:questions [--benchmarks MMLU,GSM8K] [--n 200] [--dry-run | --write] [--replace] [--no-cache]",
    "",
    `Fetched rows are cached in ${DEFAULT_ROW_CACHE_DIR} (read-only HF traffic is rate limited); --no-cache bypasses it.`,
    "",
    `Supported: ${BENCHMARK_DATASETS.map((c) => c.benchmark).join(", ")}`,
    `Not runnable yet (no questions imported): ${Object.keys(UNSUPPORTED_BENCHMARKS).join(", ")}`,
  ].join("\n");
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      benchmarks: { type: "string" },
      n: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      replace: { type: "boolean", default: false },
      "no-cache": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }
  if (values.write && values["dry-run"]) throw new Error("--write and --dry-run are mutually exclusive");

  const n = values.n === undefined ? DEFAULT_SAMPLE_SIZE : Number(values.n);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--n must be a positive integer, got "${values.n}"`);

  let benchmarks: BenchmarkDatasetConfig[] = [...BENCHMARK_DATASETS];
  if (values.benchmarks) {
    benchmarks = [];
    for (const raw of values.benchmarks.split(",")) {
      const name = raw.trim();
      if (!name) continue;
      const unsupported = Object.keys(UNSUPPORTED_BENCHMARKS).find((b) => b.toLowerCase() === name.toLowerCase());
      if (unsupported) {
        console.log(`- ${unsupported}: not runnable yet - ${UNSUPPORTED_BENCHMARKS[unsupported]} (skipped)`);
        continue;
      }
      const config = findDatasetConfig(name);
      if (!config) throw new Error(`Unknown benchmark "${name}".\n${usage()}`);
      benchmarks.push(config);
    }
  }
  return {
    benchmarks,
    n,
    write: values.write,
    replace: values.replace,
    cache: values["no-cache"] ? undefined : createFileRowCache(),
  };
}

function preview(text: string, max = 700): string {
  const clipped = text.length > max ? `${text.slice(0, max)}\n  ...[${text.length - max} more chars]` : text;
  return clipped
    .split("\n")
    .map((line) => `  | ${line}`)
    .join("\n");
}

function describeSource(config: BenchmarkDatasetConfig): string {
  const { source } = config;
  const base = `${source.dataset} [${source.config}/${source.split}]`;
  return source.kind === "raw-json-file" ? `${base} ${source.path}@${source.revision.slice(0, 10)}` : base;
}

// --- Supabase helpers (service role; seeding exception) ---------------------

async function findBenchmark(
  supabase: SupabaseClient,
  name: string,
): Promise<{ id: string; scoring_method: string } | null> {
  const { data, error } = await supabase.from("benchmarks").select("id, name, scoring_method").eq("name", name).maybeSingle();
  if (error) throw new Error(`benchmarks lookup failed: ${error.message} (${error.code})`);
  if (!data) return null;
  const row = data as { id: unknown; scoring_method: unknown };
  if (typeof row.id !== "string" || typeof row.scoring_method !== "string") throw new Error("benchmarks row malformed");
  return { id: row.id, scoring_method: row.scoring_method };
}

async function fetchExistingQuestions(supabase: SupabaseClient, benchmarkId: string): Promise<ExistingQuestion[]> {
  const out: ExistingQuestion[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("benchmark_questions")
      .select("id, metadata")
      .eq("benchmark_id", benchmarkId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`benchmark_questions read failed: ${error.message} (${error.code})`);
    const rows = (data ?? []) as { id: string; metadata: unknown }[];
    out.push(...rows.map((r) => ({ id: r.id, metadata: r.metadata })));
    if (rows.length < PAGE) return out;
  }
}

async function countReferencingResults(supabase: SupabaseClient, questionIds: readonly string[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const { count, error } = await supabase
      .from("evaluation_results")
      .select("id", { count: "exact", head: true })
      .in("question_id", questionIds.slice(i, i + CHUNK));
    if (error) throw new Error(`evaluation_results count failed: ${error.message} (${error.code})`);
    total += count ?? 0;
  }
  return total;
}

async function deleteQuestions(supabase: SupabaseClient, ids: readonly string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from("benchmark_questions").delete().in("id", ids.slice(i, i + CHUNK));
    if (error) throw new Error(`benchmark_questions delete failed: ${error.message} (${error.code})`);
  }
}

/** Inserts in chunks; on failure removes the rows this call inserted so a retry starts clean. */
async function insertQuestions(
  supabase: SupabaseClient,
  benchmarkId: string,
  questions: readonly ImportedQuestion[],
): Promise<string[]> {
  const inserted: string[] = [];
  try {
    for (let i = 0; i < questions.length; i += CHUNK) {
      const rows = questions.slice(i, i + CHUNK).map((q) => ({
        benchmark_id: benchmarkId,
        prompt: q.prompt,
        expected_answer: q.expected_answer,
        metadata: q.metadata,
      }));
      const { data, error } = await supabase.from("benchmark_questions").insert(rows).select("id");
      if (error) throw new Error(`benchmark_questions insert failed: ${error.message} (${error.code})`);
      inserted.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
    }
    return inserted;
  } catch (err) {
    if (inserted.length > 0) {
      console.error(`  ! insert failed after ${inserted.length} rows; removing them so the import can be re-run cleanly`);
      await deleteQuestions(supabase, inserted);
    }
    throw err;
  }
}

function describePlan(plan: ImportPlan): string {
  switch (plan.action) {
    case "insert":
      return plan.toInsert.length === 0
        ? `up to date (${plan.alreadyPresent} already present)`
        : `insert ${plan.toInsert.length} (${plan.alreadyPresent} already present)`;
    case "replace":
      return `replace: delete ${plan.deleteIds.length} existing, insert ${plan.toInsert.length}`;
    case "refuse":
      return `refused: ${plan.reason}`;
  }
}

// --- main --------------------------------------------------------------------

async function processBenchmark(
  config: BenchmarkDatasetConfig,
  options: CliOptions,
  supabase: SupabaseClient | null,
): Promise<Outcome> {
  const name = config.benchmark;
  console.log(`\n=== ${name} - ${describeSource(config)} (${config.format}, ${config.scoringMethod})`);
  if (config.notes) console.log(`  note: ${config.notes}`);

  const token = process.env.HF_TOKEN;
  if (config.source.kind === "datasets-server" && config.source.gated && !token) {
    console.log("  skipped: gated dataset and HF_TOKEN is not set");
    return { benchmark: name, status: "skipped", detail: "gated; HF_TOKEN not set" };
  }

  let questions: ImportedQuestion[];
  let total: number;
  try {
    const loaded = await loadBenchmarkSample(config, options.n, {
      token,
      onRetry: (message) => console.log(`  (retry) ${message}`),
    }, options.cache);
    questions = loaded.questions;
    total = loaded.total;
  } catch (err) {
    console.error(`  FAILED to load: ${(err as Error).message}`);
    return { benchmark: name, status: "failed", detail: (err as Error).message };
  }

  console.log(`  upstream rows: ${total} | sample: ${questions.length} (sample_index 0..${questions.length - 1})`);
  for (const q of questions.slice(0, 2)) {
    console.log(`  --- sample_index ${q.metadata.sample_index} (row ${q.metadata.row_index}) expected: ${JSON.stringify(q.expected_answer.slice(0, 120))}`);
    console.log(preview(q.prompt));
  }

  if (!supabase) {
    return { benchmark: name, status: "ok", detail: `${questions.length} questions built (no DB check: Supabase env not set)` };
  }

  try {
    const benchmark = await findBenchmark(supabase, name);
    if (!benchmark) {
      return { benchmark: name, status: "failed", detail: "no benchmarks row with this name (run pnpm db:seed first)" };
    }
    if (benchmark.scoring_method !== config.scoringMethod) {
      return {
        benchmark: name,
        status: "refused",
        detail: `benchmark declares scoring_method=${benchmark.scoring_method} but these questions need ${config.scoringMethod}`,
      };
    }

    const existing = await fetchExistingQuestions(supabase, benchmark.id);
    const plan = planImport(config, existing, questions, options.replace);

    if (plan.action === "replace" && plan.deleteIds.length > 0) {
      const referencing = await countReferencingResults(supabase, plan.deleteIds);
      if (referencing > 0) {
        return {
          benchmark: name,
          status: "refused",
          detail: `${referencing} evaluation_results reference its ${plan.deleteIds.length} existing questions; run \`pnpm db:purge:seeded\` first`,
        };
      }
    }

    console.log(`  existing questions: ${existing.length} | plan: ${describePlan(plan)}`);
    if (plan.action === "refuse") return { benchmark: name, status: "refused", detail: plan.reason };
    if (!options.write) return { benchmark: name, status: "ok", detail: `dry run - would ${describePlan(plan)}` };

    if (plan.action === "insert") {
      const ids = await insertQuestions(supabase, benchmark.id, plan.toInsert);
      return { benchmark: name, status: "ok", detail: `inserted ${ids.length}, ${plan.alreadyPresent} already present` };
    }
    // Replace: insert the new sample first so a failed insert leaves the old questions intact.
    const ids = await insertQuestions(supabase, benchmark.id, plan.toInsert);
    await deleteQuestions(supabase, plan.deleteIds);
    return { benchmark: name, status: "ok", detail: `replaced ${plan.deleteIds.length} with ${ids.length}` };
  } catch (err) {
    console.error(`  FAILED: ${(err as Error).message}`);
    return { benchmark: name, status: "failed", detail: (err as Error).message };
  }
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (options.write && (!url || !key)) {
    throw new Error("--write needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  console.log(
    `${options.write ? "WRITE" : "DRY RUN (no writes; pass --write to insert)"} | n=${options.n}${options.replace ? " | --replace" : ""} | ${options.benchmarks.length} benchmark(s)`,
  );

  const outcomes: Outcome[] = [];
  for (const config of options.benchmarks) {
    outcomes.push(await processBenchmark(config, options, supabase));
  }

  console.log("\n=== Summary");
  for (const o of outcomes) console.log(`  ${o.status.toUpperCase().padEnd(8)} ${o.benchmark.padEnd(14)} ${o.detail}`);
  for (const [name, reason] of Object.entries(UNSUPPORTED_BENCHMARKS)) {
    console.log(`  ${"NO-QS".padEnd(8)} ${name.padEnd(14)} not runnable yet: ${reason}`);
  }
  if (outcomes.some((o) => o.status === "failed" || o.status === "refused")) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
