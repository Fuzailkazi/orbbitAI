-- 007: indexes for the hot read paths (Cache Components data layer, eval runner, drill-down).
-- Additive only: every statement is IF NOT EXISTS and nothing is dropped, so it is safe to
-- re-run. Existing single-column indexes from 001-003 are kept.

-- ---------------------------------------------------------------------------
-- evaluations
-- ---------------------------------------------------------------------------

-- Completed-evaluation aggregates (src/lib/data/evaluations.ts, landing, leaderboard, compare,
-- spaces, overview): WHERE status = 'completed' ORDER BY accuracy DESC NULLS LAST, completed_at DESC.
CREATE INDEX IF NOT EXISTS idx_evaluations_status_accuracy
  ON evaluations (status, accuracy DESC NULLS LAST, completed_at DESC NULLS LAST);

-- "Latest run" lookups and recent-activity lists: WHERE status = ? ORDER BY completed_at DESC.
CREATE INDEX IF NOT EXISTS idx_evaluations_status_completed_at
  ON evaluations (status, completed_at DESC NULLS LAST);

-- Per model / per pair: model detail (model_id + status), batch planner
-- (status = 'completed' AND model_id IN … AND benchmark_id IN …), latest-per-pair.
CREATE INDEX IF NOT EXISTS idx_evaluations_model_status_benchmark
  ON evaluations (model_id, status, benchmark_id);

-- Stalled-run reaper (src/lib/eval/stalled.ts): WHERE status = 'running' AND created_at < cutoff.
CREATE INDEX IF NOT EXISTS idx_evaluations_running_created_at
  ON evaluations (created_at)
  WHERE status = 'running';

-- ---------------------------------------------------------------------------
-- evaluation_results (prompt-level drill-down, always uncached)
-- ---------------------------------------------------------------------------

-- Drill-down: WHERE evaluation_id = ? ORDER BY created_at; activity check:
-- WHERE evaluation_id IN (…) AND created_at >= since.
CREATE INDEX IF NOT EXISTS idx_evaluation_results_evaluation_created_at
  ON evaluation_results (evaluation_id, created_at);

-- ---------------------------------------------------------------------------
-- benchmark_questions
-- ---------------------------------------------------------------------------

-- Runner question sample + runnable counts (evaluate page, batch planner):
-- WHERE benchmark_id = ? AND metadata->>'source' = 'hf'
-- ORDER BY metadata->'sample_index' (jsonb compare), created_at.
CREATE INDEX IF NOT EXISTS idx_benchmark_questions_source_sample
  ON benchmark_questions (benchmark_id, (metadata ->> 'source'), (metadata -> 'sample_index'), created_at);

-- ---------------------------------------------------------------------------
-- models
-- ---------------------------------------------------------------------------

-- Catalog / pickers: WHERE is_active ORDER BY name (and vendor, name for the live-run picker).
CREATE INDEX IF NOT EXISTS idx_models_active_name
  ON models (name)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_models_active_vendor_name
  ON models (vendor, name)
  WHERE is_active;
