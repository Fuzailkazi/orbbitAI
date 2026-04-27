// Database types — mirrors Supabase schema exactly (snake_case)

// === ENUMS ===

export type ModelCategory =
  | "chat"
  | "reasoning"
  | "code"
  | "vision"
  | "embedding"
  | "moe"
  | "transformer";

export type BenchmarkCategory =
  | "reasoning"
  | "math"
  | "code"
  | "chat"
  | "factuality"
  | "science"
  | "general"
  | "agentic";

export type ScoringMethod =
  | "exact_match"
  | "normalized_match"
  | "pass_at_k"
  | "llm_judge"
  | "bleu"
  | "rouge";

export type EvaluationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// === TABLE ROWS ===

export interface Model {
  id: string;
  name: string;
  vendor: string;
  category: ModelCategory;
  context_window: number;
  pricing_input: number;
  pricing_output: number;
  api_identifier: string;
  release_date: string | null;
  is_active: boolean;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  category: BenchmarkCategory;
  scoring_method: ScoringMethod;
  total_questions: number;
  source_url: string | null;
  created_at: string;
}

export interface BenchmarkQuestion {
  id: string;
  benchmark_id: string;
  prompt: string;
  expected_answer: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Evaluation {
  id: string;
  model_id: string;
  benchmark_id: string;
  status: EvaluationStatus;
  accuracy: number | null;
  accuracy_ci_lower: number | null;
  accuracy_ci_upper: number | null;
  avg_latency_ms: number | null;
  median_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  failure_rate: number | null;
  tokens_per_second: number | null;
  questions_evaluated: number;
  questions_correct: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EvaluationResult {
  id: string;
  evaluation_id: string;
  question_id: string;
  model_response: string;
  is_correct: boolean;
  score: number;
  latency_ms: number;
  tokens_used: number;
  time_to_first_token_ms: number | null;
  judge_reasoning: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  icon: string;
  benchmark_ids: string[];
  created_at: string;
}

export interface SpaceBenchmark {
  id: string;
  space_id: string;
  benchmark_id: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// === INSERT TYPES (omit auto-generated fields) ===

export type ModelInsert = Omit<Model, "id" | "created_at" | "updated_at">;
export type BenchmarkInsert = Omit<Benchmark, "id" | "created_at">;
export type EvaluationInsert = Omit<Evaluation, "id" | "created_at">;
export type SpaceInsert = Omit<Space, "id" | "created_at">;

// === VALUE SCORE (app-level, not a DB table) ===

export interface ValueScoreWeights {
  quality: number;
  cost: number;
  speed: number;
}

export interface ValueScore {
  model_id: string;
  composite_score: number;
  quality_normalized: number;
  cost_normalized: number;
  speed_normalized: number;
  weights_used: ValueScoreWeights;
}
