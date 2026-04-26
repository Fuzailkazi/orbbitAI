-- 002_create_benchmarks.sql
-- Benchmark definitions and individual test questions

CREATE TYPE benchmark_category AS ENUM (
  'reasoning', 'math', 'code', 'chat', 'factuality', 'science', 'general', 'agentic'
);

CREATE TYPE scoring_method AS ENUM (
  'exact_match', 'normalized_match', 'pass_at_k', 'llm_judge', 'bleu', 'rouge'
);

CREATE TABLE benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category benchmark_category NOT NULL,
  scoring_method scoring_method NOT NULL DEFAULT 'exact_match',
  total_questions INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE benchmark_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_benchmark_questions_benchmark ON benchmark_questions(benchmark_id);
