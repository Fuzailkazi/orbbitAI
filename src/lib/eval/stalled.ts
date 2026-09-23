import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evaluation } from "@/types/database";
import { EVAL_ACTIVITY_WINDOW_MS, EVAL_STALL_THRESHOLD_MS } from "./limits";

/**
 * Stalled-run detection.
 *
 * A run whose process died before finalizing leaves its row in `running` forever. Such rows
 * are detected by age (started_at older than EVAL_STALL_THRESHOLD_MS) and moved to `failed`
 * by a server-side update scoped to those row ids AND `status = 'running'`, so a completed
 * row can never be touched (rule 5). Per-prompt results inserted before the abort are kept
 * (rule 2 — traceable to the prompt level).
 *
 * Batch runs (scripts/run-batch.ts) have no wall-clock deadline and legitimately stay
 * `running` far longer than the threshold. Before failing a row, the DB-backed helpers check
 * for recent activity: a row that inserted a per-prompt result within EVAL_ACTIVITY_WINDOW_MS
 * is alive and is left alone.
 *
 * The `evaluations` table has no error-message column, so the reason is derived for display:
 * a failed row with no accuracy, no recorded prompts (`questions_evaluated = 0`, which only
 * the reaper leaves behind — the runner always writes its attempted count) and whose
 * completed_at is past the stall threshold was closed by this reaper.
 */
export const STALLED_RUN_MESSAGE = `Run stopped responding: it exceeded the ${Math.round(
  EVAL_STALL_THRESHOLD_MS / 60_000
)}-minute run limit without finalizing and was marked failed. Prompts that finished before it stopped are kept.`;

type StallCandidate = Pick<Evaluation, "status" | "started_at" | "created_at">;
type ReapedCandidate = Pick<Evaluation, "status" | "started_at" | "created_at" | "completed_at" | "accuracy"> &
  Partial<Pick<Evaluation, "questions_evaluated">>;

function startedAtMs(row: StallCandidate): number | null {
  const ts = Date.parse(row.started_at ?? row.created_at);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * `running` for longer than any live request can last. `lastActivityMs` (latest per-prompt
 * insert, when known) extends liveness for long batch runs.
 */
export function isStalledRunning(row: StallCandidate, now = Date.now(), lastActivityMs: number | null = null): boolean {
  if (row.status !== "running") return false;
  const started = startedAtMs(row);
  if (started === null || now - started <= EVAL_STALL_THRESHOLD_MS) return false;
  return lastActivityMs === null || now - lastActivityMs > EVAL_ACTIVITY_WINDOW_MS;
}

/** A `failed` row that the stall reaper closed (see module comment). */
export function wasReapedAsStalled(row: ReapedCandidate): boolean {
  if (row.status !== "failed" || row.accuracy !== null || !row.completed_at) return false;
  // The runner's own failure paths always write the attempted count; the reaper never does.
  if (typeof row.questions_evaluated === "number" && row.questions_evaluated > 0) return false;
  const started = startedAtMs(row);
  const completed = Date.parse(row.completed_at);
  return started !== null && Number.isFinite(completed) && completed - started > EVAL_STALL_THRESHOLD_MS;
}

/** Stalled either way: still stuck in `running`, or already closed by the reaper. */
export function isStalledEvaluation(row: ReapedCandidate, now = Date.now(), lastActivityMs: number | null = null): boolean {
  return isStalledRunning(row, now, lastActivityMs) || wasReapedAsStalled(row);
}

/**
 * Of the given `running` row ids, those that inserted a per-prompt result within the
 * activity window (i.e. a live batch run). Throws on a query error so callers never fail a
 * row they could not check.
 */
export async function findRecentlyActiveEvaluations(
  admin: SupabaseClient,
  ids: readonly string[],
  now = Date.now()
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const since = new Date(now - EVAL_ACTIVITY_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("evaluation_results")
    .select("evaluation_id")
    .in("evaluation_id", [...ids])
    .gte("created_at", since)
    .limit(1000);
  if (error) throw new Error(`Failed to check evaluation activity: ${error.message}`);
  return new Set(((data ?? []) as { evaluation_id: string }[]).map((r) => r.evaluation_id));
}

/**
 * Marks the given stalled rows failed, skipping any that are still inserting results. Must be
 * called with a server-only (service-role) client — `evaluations` has no RLS write policy.
 * Returns the ids actually transitioned.
 */
export async function failStalledEvaluations(
  admin: SupabaseClient,
  ids: readonly string[],
  now = Date.now()
): Promise<string[]> {
  if (ids.length === 0) return [];
  const active = await findRecentlyActiveEvaluations(admin, ids, now);
  const inactive = ids.filter((id) => !active.has(id));
  if (inactive.length === 0) return [];
  const { data, error } = await admin
    .from("evaluations")
    .update({ status: "failed", completed_at: new Date(now).toISOString() })
    .in("id", inactive)
    .eq("status", "running")
    .select("id");
  if (error) throw new Error(`Failed to close stalled evaluations: ${error.message}`);
  const closed = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (closed.length > 0) {
    console.warn(`Marked ${closed.length} stalled evaluation(s) failed: ${STALLED_RUN_MESSAGE}`, closed);
  }
  return closed;
}

/** Finds every stalled `running` row and marks it failed. Best-effort; used when a new run starts. */
export async function reapStalledEvaluations(admin: SupabaseClient, now = Date.now()): Promise<string[]> {
  const cutoff = new Date(now - EVAL_STALL_THRESHOLD_MS).toISOString();
  const { data, error } = await admin
    .from("evaluations")
    .select("id, status, started_at, created_at")
    .eq("status", "running")
    .lt("created_at", cutoff)
    .limit(100);
  if (error) throw new Error(`Failed to look up stalled evaluations: ${error.message}`);
  const rows = (data ?? []) as (StallCandidate & { id: string })[];
  const stalled = rows.filter((r) => isStalledRunning(r, now)).map((r) => r.id);
  return failStalledEvaluations(admin, stalled, now);
}

/**
 * For a list view: returns the ids to display as Stalled and closes any still-`running`
 * stalled rows as failed (server-side, scoped to those ids). Rows that are still inserting
 * results (live batch runs) are neither closed nor reported. If the cleanup fails, the rows
 * are reported by timestamp alone.
 */
export async function settleStalledEvaluations(
  rows: readonly (ReapedCandidate & { id: string })[],
  getAdminClient: () => SupabaseClient
): Promise<Set<string>> {
  const now = Date.now();
  const stalledRunningIds = rows.filter((r) => isStalledRunning(r, now)).map((r) => r.id);
  let stillActive = new Set<string>();
  if (stalledRunningIds.length > 0) {
    try {
      const admin = getAdminClient();
      stillActive = await findRecentlyActiveEvaluations(admin, stalledRunningIds, now);
      await failStalledEvaluations(
        admin,
        stalledRunningIds.filter((id) => !stillActive.has(id)),
        now
      );
    } catch (err) {
      console.error("Failed to close stalled evaluations:", err);
    }
  }
  return new Set(rows.filter((r) => !stillActive.has(r.id) && isStalledEvaluation(r, now)).map((r) => r.id));
}
