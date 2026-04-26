-- 003_create_evaluations.sql
-- Evaluation runs and per-prompt results

CREATE TYPE evaluation_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  status evaluation_status NOT NULL DEFAULT 'pending',
  accuracy NUMERIC(6, 3),
  accuracy_ci_lower NUMERIC(6, 3),
  accuracy_ci_upper NUMERIC(6, 3),
  avg_latency_ms NUMERIC(10, 2),
  median_latency_ms NUMERIC(10, 2),
  p95_latency_ms NUMERIC(10, 2),
  total_tokens INTEGER,
  total_cost NUMERIC(10, 6),
  failure_rate NUMERIC(6, 3),
  tokens_per_second NUMERIC(10, 2),
  questions_evaluated INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES benchmark_questions(id) ON DELETE CASCADE,
  model_response TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC(5, 4) NOT NULL DEFAULT 0,
  latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  time_to_first_token_ms NUMERIC(10, 2),
  judge_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_model ON evaluations(model_id);
CREATE INDEX idx_evaluations_benchmark ON evaluations(benchmark_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_evaluation_results_evaluation ON evaluation_results(evaluation_id);
CREATE INDEX idx_evaluation_results_question ON evaluation_results(question_id);
