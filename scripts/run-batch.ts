/**
 * Evaluation batch CLI — runs real benchmark questions on free OpenRouter models.
 *
 *   pnpm eval:batch --models auto --benchmarks runnable --n 100 --rpm 16 --daily-cap 900 [--concurrency 3] [--dry-run]
 *   (= tsx --env-file=.env.local scripts/run-batch.ts …)
 *
 * - Free models only (api_identifier ends with ":free"); every run goes through runEvaluation,
 *   so per-prompt rows, Wilson CIs and failure recording follow the same rules as the UI.
 * - Resumable: pairs with a completed evaluation covering the sample are skipped.
 * - Daily budget: the local ledger (scripts/.batch-state.json, per UTC day) enforces
 *   --daily-cap across restarts; GET /api/v1/key (free_model_daily_requests) is the
 *   authoritative account-wide counter and clamps the budget when reachable.
 * - A pair is only started if its estimated requests fit in what is left today.
 * - Daily quota exhausted → the current evaluation is finalized as failed and the batch stops.
 * - Concurrency: up to --concurrency prompts (default 3) are in flight per evaluation; request
 *   starts stay paced by --rpm, so the request rate is unchanged — slow calls just overlap.
 *   Progress lines can therefore print out of question order.
 * - Ctrl-C once: start no new prompt, let the in-flight prompts finish, finalize the evaluation
 *   as failed, exit. Twice: abort the in-flight requests too. Three times: exit immediately.
 * - Cached pages: the dashboard reads completed evaluations through Next's "use cache" layer
 *   (src/lib/data). The CLI runs outside any Next server, so it cannot revalidate those caches
 *   (and deliberately does not import next/cache); batch-written results appear on cached pages
 *   within the `evaluations` cacheLife window (~5 min), or at the next deploy/build.
 * - --dry-run: prints the plan; no writes, no model calls (the key counter is read, which is
 *   not a model call).
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../src/lib/supabase/admin";
import { OpenRouterClient, OpenRouterError, type OpenRouterKeyStatus } from "../src/lib/openrouter/client";
import { isFreeModelId, resolveJudgeModel } from "../src/lib/openrouter/free-models";
import { runEvaluation, EvaluationRunError, QUESTION_SOURCE, type EvaluationProgressEvent } from "../src/lib/eval/runner";
import { isSupportedScoringMethod } from "../src/lib/eval/scorers/factory";
import { BATCH_USAGE, BatchArgsError, parseBatchArgs, type BatchArgs } from "../src/lib/eval/batch/args";
import { RequestPacer, intervalForRpm } from "../src/lib/eval/batch/pacing";
import {
  effectiveDailyCapacity,
  estimateDays,
  fitPairsToBudget,
  pairExceedsDailyCapacity,
  planBatch,
  remainingDailyBudget,
  selectRunnableBenchmarks,
  type CompletedEvaluationRef,
  type PlanBenchmark,
  type PlanModel,
  type PlannedPair,
} from "../src/lib/eval/batch/planning";
import { rankAutoCandidates, type CandidateModel } from "../src/lib/eval/batch/models";
import {
  addRequests,
  emptyBatchState,
  msUntilUtcMidnight,
  parseBatchState,
  requestsUsedOn,
  utcDayKey,
  type BatchState,
} from "../src/lib/eval/batch/state";

const STATE_FILE = path.join(process.cwd(), "scripts", ".batch-state.json");
/** Extra probes allowed beyond the target model count when candidates turn out unavailable. */
const EXTRA_PROBES = 4;

// ---------- small utilities ----------

function log(message = ""): void {
  console.log(message);
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function loadState(): BatchState {
  try {
    return parseBatchState(JSON.parse(readFileSync(STATE_FILE, "utf8")));
  } catch {
    return emptyBatchState();
  }
}

function saveState(state: BatchState): void {
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, STATE_FILE);
}

/** Ledger wrapper: every OpenRouter request the batch makes is recorded against its UTC day. */
class RequestLedger {
  private state: BatchState;
  /** Requests recorded since the key counter was last read (it is stale by this much). */
  private sinceKeyRead = 0;
  constructor(private readonly persist: boolean) {
    this.state = loadState();
  }
  usedToday(now = Date.now()): number {
    return requestsUsedOn(this.state, utcDayKey(now));
  }
  record(count: number, now = Date.now()): void {
    if (count <= 0) return;
    this.state = addRequests(this.state, utcDayKey(now), count);
    this.sinceKeyRead += count;
    if (this.persist) saveState(this.state);
  }
  spentSinceKeyRead(): number {
    return this.sinceKeyRead;
  }
  markKeyRead(): void {
    this.sinceKeyRead = 0;
  }
}

async function readKeyStatus(client: OpenRouterClient): Promise<OpenRouterKeyStatus | null> {
  try {
    return await client.getKeyStatus();
  } catch (err) {
    log(`! Could not read the OpenRouter key counter (${err instanceof Error ? err.message : String(err)}); using the local ledger only.`);
    return null;
  }
}

function keyBudget(
  status: OpenRouterKeyStatus | null,
  spentSinceRead = 0
): { limit: number; remaining: number } | null {
  const daily = status?.freeModelDailyRequests;
  return daily ? { limit: daily.limit, remaining: Math.max(0, daily.remaining - spentSinceRead) } : null;
}

function resumeHint(now = Date.now()): string {
  return `Resume after the daily reset (00:00 UTC, in ${fmtDuration(msUntilUtcMidnight(now))}) by re-running the same command — completed pairs are skipped.`;
}

// ---------- data loading (read-only) ----------

interface ModelRow extends CandidateModel {
  pricing_input: number;
  pricing_output: number;
}

async function loadBenchmarks(db: SupabaseClient, args: BatchArgs): Promise<PlanBenchmark[]> {
  const { data, error } = await db.from("benchmarks").select("id, name, scoring_method").order("name");
  if (error) throw new Error(`Failed to load benchmarks: ${error.message}`);
  let rows = (data ?? []) as { id: string; name: string; scoring_method: string }[];

  if (args.benchmarks !== "runnable") {
    const wanted = args.benchmarks.map((b) => b.toLowerCase());
    const unknown = wanted.filter((w) => !rows.some((r) => r.id === w || r.name.toLowerCase() === w));
    if (unknown.length > 0) throw new BatchArgsError(`Unknown benchmark(s): ${unknown.join(", ")}`);
    rows = rows.filter((r) => wanted.includes(r.id) || wanted.includes(r.name.toLowerCase()));
  }

  const out: PlanBenchmark[] = [];
  for (const r of rows) {
    const { count, error: countErr } = await db
      .from("benchmark_questions")
      .select("id", { count: "exact", head: true })
      .eq("benchmark_id", r.id)
      .eq("metadata->>source", QUESTION_SOURCE);
    if (countErr) throw new Error(`Failed to count questions for ${r.name}: ${countErr.message}`);
    out.push({ ...r, hfQuestions: count ?? 0 });
  }
  return out;
}

async function loadFreeModels(db: SupabaseClient): Promise<ModelRow[]> {
  const { data, error } = await db
    .from("models")
    .select("id, name, vendor, api_identifier, is_active, category, context_window, release_date, pricing_input, pricing_output")
    .like("api_identifier", "%:free");
  if (error) throw new Error(`Failed to load models: ${error.message}`);
  return ((data ?? []) as ModelRow[]).filter((m) => isFreeModelId(m.api_identifier));
}

async function resolveExplicitModels(db: SupabaseClient, ids: string[]): Promise<PlanModel[]> {
  const { data, error } = await db.from("models").select("id, name, api_identifier, is_active");
  if (error) throw new Error(`Failed to load models: ${error.message}`);
  const rows = (data ?? []) as (PlanModel & { is_active: boolean })[];
  const out: PlanModel[] = [];
  for (const wanted of ids) {
    const row = rows.find((r) => r.id === wanted || r.api_identifier === wanted);
    if (!row) throw new BatchArgsError(`Unknown model "${wanted}" (use a model UUID or api_identifier).`);
    if (!isFreeModelId(row.api_identifier)) {
      throw new BatchArgsError(`"${row.api_identifier}" is not a free-tier model; only ":free" models may be evaluated.`);
    }
    out.push({ id: row.id, name: row.name, api_identifier: row.api_identifier });
  }
  return out;
}

async function loadCompleted(
  db: SupabaseClient,
  modelIds: string[],
  benchmarkIds: string[]
): Promise<CompletedEvaluationRef[]> {
  if (modelIds.length === 0 || benchmarkIds.length === 0) return [];
  const { data, error } = await db
    .from("evaluations")
    .select("model_id, benchmark_id, questions_evaluated")
    .eq("status", "completed")
    .in("model_id", modelIds)
    .in("benchmark_id", benchmarkIds);
  if (error) throw new Error(`Failed to load completed evaluations: ${error.message}`);
  return (data ?? []) as CompletedEvaluationRef[];
}

// ---------- auto model selection ----------

type ProbeOutcome = { ok: true } | { ok: false; reason: string; stopBatch: boolean };

async function probeModel(client: OpenRouterClient, pacer: RequestPacer, apiIdentifier: string): Promise<ProbeOutcome> {
  await pacer.acquire(1);
  try {
    await client.createChatCompletion(
      { model: apiIdentifier, messages: [{ role: "user", content: "Reply with OK" }], temperature: 0, max_tokens: 16 },
      undefined,
      { timeoutMs: 60_000 }
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return { ok: false, reason: `${err.kind}: ${err.message}`, stopBatch: err.stopsBatch };
    }
    return { ok: false, reason: err instanceof Error ? err.message : String(err), stopBatch: false };
  }
}

/** Live OpenRouter ids (GET /models — not a model call, no quota), or null when unreachable. */
async function readLiveModelIds(client: OpenRouterClient): Promise<Set<string> | null> {
  try {
    const ids = await client.listModelIds();
    return ids.size > 0 ? ids : null;
  } catch (err) {
    log(`! Could not read OpenRouter's model list (${err instanceof Error ? err.message : String(err)}); retired models will only be caught by probes.`);
    return null;
  }
}

async function pickAutoModels(
  db: SupabaseClient,
  args: BatchArgs,
  liveIds: Set<string> | null,
  deps: { client: OpenRouterClient; pacer: RequestPacer; ledger: RequestLedger; budget: () => number } | null
): Promise<{ models: PlanModel[]; stopped: string | null }> {
  const ranked = rankAutoCandidates(await loadFreeModels(db));
  const retired = liveIds ? ranked.filter((m) => !liveIds.has(m.api_identifier)) : [];
  const candidates = liveIds ? ranked.filter((m) => liveIds.has(m.api_identifier)) : ranked;
  if (retired.length > 0) {
    log(
      `Skipping ${retired.length} catalog model(s) no longer served by OpenRouter (not probed): ${retired
        .map((m) => m.api_identifier)
        .join(", ")}`
    );
  }
  if (candidates.length === 0) return { models: [], stopped: "No active free models in the models table." };

  if (!deps) {
    // Dry run: no probes — show the ranked candidates that would be probed.
    const shown = candidates.slice(0, args.autoModelCount);
    log(`Auto models (dry run, NOT probed — ${candidates.length} eligible, first ${shown.length} would be probed in this order):`);
    for (const m of shown) log(`  - ${m.api_identifier}  (${m.name})`);
    const extra = candidates.slice(args.autoModelCount, args.autoModelCount + EXTRA_PROBES);
    if (extra.length > 0) log(`  fallbacks if a probe fails: ${extra.map((m) => m.api_identifier).join(", ")}`);
    return { models: shown.map((m) => ({ id: m.id, name: m.name, api_identifier: m.api_identifier })), stopped: null };
  }

  const chosen: PlanModel[] = [];
  const maxProbes = args.autoModelCount + EXTRA_PROBES;
  let probes = 0;
  log(`Probing free models (1 tiny request each, counted against the daily cap):`);
  for (const m of candidates) {
    if (chosen.length >= args.autoModelCount || probes >= maxProbes) break;
    if (deps.budget() < 1) return { models: chosen, stopped: "Daily budget exhausted while probing models." };
    probes++;
    const outcome = await probeModel(deps.client, deps.pacer, m.api_identifier);
    deps.ledger.record(1);
    if (outcome.ok) {
      chosen.push({ id: m.id, name: m.name, api_identifier: m.api_identifier });
      log(`  ok      ${m.api_identifier}`);
    } else {
      log(`  dropped ${m.api_identifier} — ${outcome.reason.slice(0, 160)}`);
      if (outcome.stopBatch) return { models: chosen, stopped: `Probe hit a quota/auth stop: ${outcome.reason}` };
    }
  }
  log(`Chosen models (${chosen.length}): ${chosen.map((m) => m.api_identifier).join(", ") || "none"}`);
  return { models: chosen, stopped: null };
}

// ---------- plan printing ----------

function printPlan(
  pairs: readonly PlannedPair[],
  totalRequests: number,
  dailyCapacity: number,
  remainingToday: number,
  maxEvals: number | null
): void {
  log(`\nPlan: ${pairs.length} evaluation(s), ~${totalRequests} requests total.`);
  if (pairs.length > 0) {
    log(`  ${pad("benchmark", 16)} ${pad("scorer", 17)} ${pad("model", 52)} ${pad("n", 5)} req`);
    for (const p of pairs) {
      log(
        `  ${pad(p.benchmark.name, 16)} ${pad(p.benchmark.scoring_method, 17)} ${pad(p.model.api_identifier, 52)} ${pad(String(p.questions), 5)} ${p.estimatedRequests}`
      );
    }
  }
  const days = estimateDays(totalRequests, dailyCapacity);
  log(
    `Daily capacity: ${dailyCapacity} requests/day; remaining today: ${remainingToday}. Estimated: ${
      Number.isFinite(days) ? `${days} day(s)` : "never (capacity is 0)"
    } at the cap.`
  );
  const tooBig = pairs.filter((p) => pairExceedsDailyCapacity(p, dailyCapacity));
  if (tooBig.length > 0) {
    log(
      `! ${tooBig.length} pair(s) need more requests than one day allows (${dailyCapacity}); they can never start. Lower --n (≤ ${Math.floor(
        dailyCapacity / 2
      )} for judge benchmarks, ≤ ${dailyCapacity} otherwise) or raise the account's daily limit (buying 10 OpenRouter credits lifts :free to 1000/day).`
    );
  }
  const today = fitPairsToBudget(
    pairs.filter((p) => !pairExceedsDailyCapacity(p, dailyCapacity)),
    remainingToday,
    maxEvals
  );
  log(
    `Today: ${today.runnable.length} evaluation(s) fit (~${today.usedRequests} requests)${
      today.blockedBy ? `; next blocked: ${today.blockedBy.benchmark.name} × ${today.blockedBy.model.api_identifier} (${today.blockedBy.estimatedRequests} req)` : ""
    }.`
  );
}

// ---------- main ----------

async function main(): Promise<number> {
  let args: BatchArgs | null;
  try {
    args = parseBatchArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(BATCH_USAGE);
    return 2;
  }
  if (!args) {
    log(BATCH_USAGE);
    return 0;
  }

  const db = createAdminClient();
  const client = new OpenRouterClient();
  const ledger = new RequestLedger(!args.dryRun);
  const pacer = new RequestPacer(intervalForRpm(args.rpm));

  log(`Orbbit eval batch${args.dryRun ? " (DRY RUN — no writes, no model calls)" : ""}`);
  log(
    `  n=${args.n} rpm=${args.rpm} concurrency=${args.concurrency} daily-cap=${args.dailyCap} max-tokens=${args.maxTokens}${
      args.maxEvals ? ` max-evals=${args.maxEvals}` : ""
    }`
  );

  let keyStatus = await readKeyStatus(client);
  ledger.markKeyRead();
  const key = keyBudget(keyStatus);
  if (keyStatus) {
    const d = keyStatus.freeModelDailyRequests;
    log(
      `  OpenRouter key: ${keyStatus.isFreeTier ? "free tier (never bought credits)" : "has purchased credits"}; :free requests today ${
        d ? `${d.used}/${d.limit} used, ${d.remaining} remaining` : "not reported"
      } (resets 00:00 UTC).`
    );
  }
  const dailyCapacity = effectiveDailyCapacity({ dailyCap: args.dailyCap, key });
  const budget = () =>
    remainingDailyBudget({ dailyCap: args.dailyCap, localUsedToday: ledger.usedToday(), key: keyBudget(keyStatus, ledger.spentSinceKeyRead()) });
  log(`  Local ledger: ${ledger.usedToday()} request(s) used today (UTC ${utcDayKey(Date.now())}); budget left today: ${budget()}.`);

  // Benchmarks
  const allBenchmarks = await loadBenchmarks(db, args);
  const { runnable, skipped } = selectRunnableBenchmarks(allBenchmarks, { n: args.n, isSupportedMethod: isSupportedScoringMethod });
  log(`\nBenchmarks: ${runnable.length} runnable, ${skipped.length} skipped.`);
  for (const b of runnable) log(`  run   ${pad(b.name, 16)} ${pad(b.scoring_method, 17)} ${b.hfQuestions} imported question(s)`);
  for (const s of skipped) log(`  skip  ${pad(s.benchmark.name, 16)} ${s.reason}`);

  // Models
  const liveIds = await readLiveModelIds(client);
  let models: PlanModel[];
  if (args.models === "auto") {
    const picked = await pickAutoModels(db, args, liveIds, args.dryRun ? null : { client, pacer, ledger, budget });
    if (picked.stopped) {
      log(`\nStopping: ${picked.stopped}`);
      log(resumeHint());
      return 1;
    }
    models = picked.models;
  } else {
    models = await resolveExplicitModels(db, args.models);
    log(`\nModels: ${models.map((m) => m.api_identifier).join(", ")}`);
    const gone = liveIds ? models.filter((m) => !liveIds.has(m.api_identifier)) : [];
    if (gone.length > 0) {
      log(`! Not served by OpenRouter any more (dropped): ${gone.map((m) => m.api_identifier).join(", ")}`);
      models = models.filter((m) => !gone.includes(m));
    }
  }

  const completed = await loadCompleted(db, models.map((m) => m.id), runnable.map((b) => b.id));
  const fullPlan = planBatch(models, runnable, completed, args.n);
  for (const s of fullPlan.skippedPairs) log(`  done  ${s.benchmark.name} × ${s.model.api_identifier} — ${s.reason}`);
  // A model never grades its own answers (self-judging bias).
  const judge = resolveJudgeModel(process.env.JUDGE_MODEL);
  const isSelfJudged = (p: PlannedPair): boolean =>
    p.benchmark.scoring_method === "llm_judge" && p.model.api_identifier === judge;
  for (const p of fullPlan.pairs.filter(isSelfJudged)) {
    log(`  skip  ${p.benchmark.name} × ${p.model.api_identifier} — it is the judge model (set JUDGE_MODEL to another free model to run it)`);
  }
  const pairs = fullPlan.pairs.filter((p) => !isSelfJudged(p));
  const plan = { pairs, totalRequests: pairs.reduce((sum, p) => sum + p.estimatedRequests, 0) };
  printPlan(plan.pairs, plan.totalRequests, dailyCapacity, budget(), args.maxEvals);

  if (args.dryRun) {
    log(`\nDry run complete — nothing was written and no model was called.`);
    return 0;
  }
  if (plan.pairs.length === 0) {
    log(`\nNothing to run.`);
    return 0;
  }

  // Ctrl-C: 1st = finish in-flight prompts then stop; 2nd = abort the in-flight requests; 3rd = exit.
  const stop = new AbortController();
  const abort = new AbortController();
  let interrupts = 0;
  process.on("SIGINT", () => {
    interrupts++;
    if (interrupts === 1) {
      log(`\nInterrupt: starting no new prompt; finishing the in-flight ones, then finalizing the evaluation as failed. Ctrl-C again to abort them.`);
      stop.abort();
    } else if (interrupts === 2) {
      log(`\nAborting the in-flight requests…`);
      abort.abort();
    } else {
      process.exit(130);
    }
  });

  // Judge benchmarks: without a working judge every prompt would be unscored and waste quota.
  let judgeUnavailable: string | null = null;
  if (plan.pairs.some((p) => p.benchmark.scoring_method === "llm_judge") && budget() >= 1) {
    const outcome = await probeModel(client, pacer, judge);
    ledger.record(1);
    if (outcome.ok) {
      log(`\nJudge model ${judge}: ok`);
    } else {
      judgeUnavailable = `judge model ${judge} unavailable (${outcome.reason.slice(0, 160)})`;
      log(`\n! ${judgeUnavailable} — llm_judge benchmarks will be skipped.`);
      if (outcome.stopBatch) {
        log(resumeHint());
        return 1;
      }
    }
  }

  let evalsRun = 0;
  for (const pair of plan.pairs) {
    if (stop.signal.aborted) break;
    if (args.maxEvals !== null && evalsRun >= args.maxEvals) {
      log(`\nReached --max-evals ${args.maxEvals}.`);
      break;
    }
    const fresh = await readKeyStatus(client);
    if (fresh) {
      keyStatus = fresh;
      ledger.markKeyRead();
    }
    if (judgeUnavailable && pair.benchmark.scoring_method === "llm_judge") {
      log(`\nSkipping ${pair.benchmark.name} × ${pair.model.api_identifier}: ${judgeUnavailable}.`);
      continue;
    }
    if (pairExceedsDailyCapacity(pair, dailyCapacity)) {
      log(`\nSkipping ${pair.benchmark.name} × ${pair.model.api_identifier}: ~${pair.estimatedRequests} requests can never fit in one day (${dailyCapacity}).`);
      continue;
    }
    const left = budget();
    if (pair.estimatedRequests > left) {
      log(
        `\nStopping before ${pair.benchmark.name} × ${pair.model.api_identifier}: needs ~${pair.estimatedRequests} requests, ${left} left today.`
      );
      log(resumeHint());
      return 0;
    }

    log(`\n=== ${pair.benchmark.name} × ${pair.model.api_identifier} (${pair.questions} questions, ~${pair.estimatedRequests} requests) ===`);
    const onProgress = (event: EvaluationProgressEvent) => {
      if (event.type === "question_complete") {
        ledger.record(event.requests);
        const verdict = event.unscored ? "UNSCORED" : event.error ? "ERROR" : event.isCorrect ? "PASS" : "FAIL";
        log(
          `  [${event.index}/${event.total}] ${pad(verdict, 8)} ${event.latencyMs}ms ${event.tokens}tok${
            event.error ? `  ${event.errorKind ?? ""} ${event.error.slice(0, 140)}` : ""
          }`
        );
      } else if (event.type === "truncated") {
        log(`  STOPPED (${event.reason}): ${event.message}`);
      }
    };

    try {
      const out = await runEvaluation({
        modelId: pair.model.id,
        benchmarkId: pair.benchmark.id,
        limitQuestions: pair.questions,
        deadlineMs: null,
        pacer,
        maxTokens: args.maxTokens,
        concurrency: args.concurrency,
        stopSignal: stop.signal,
        abortSignal: abort.signal,
        onProgress,
      });
      evalsRun++;
      if (out.status === "completed") {
        log(
          `  -> completed: accuracy ${out.accuracy}% (95% Wilson CI ${out.ciLower}–${out.ciUpper}) on ${out.questionsScored} scored of ${out.questionsEvaluated} attempted; failure rate ${out.failureRate}%; cost $${out.totalCost.toFixed(6)} (free model); ${out.requestsUsed} requests. id=${out.evaluationId}`
        );
      } else {
        log(`  -> FAILED: ${out.error ?? "unknown reason"} id=${out.evaluationId}`);
      }
      if (out.quotaExhausted) {
        log(`\nOpenRouter daily free-model quota exhausted — stopping the batch.`);
        log(resumeHint());
        return 1;
      }
      if (out.stopReason === "interrupted") {
        log(`\nInterrupted — evaluation finalized as failed. Re-run the same command to resume.`);
        return 130;
      }
    } catch (err) {
      if (err instanceof EvaluationRunError && err.code !== "DATABASE_ERROR") {
        log(`  -> skipped: ${err.code}: ${err.message}`);
        continue;
      }
      console.error(`  -> run error: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  log(`\nBatch finished: ${evalsRun} evaluation(s) run. Requests used today (local ledger): ${ledger.usedToday()}.`);
  if (evalsRun > 0) {
    log(`Cached dashboard pages pick up these results within ~5 minutes (the CLI cannot revalidate a running Next server).`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
