/** Free-form per-question metadata stored in benchmark_questions.metadata (JSONB). */
export type ScorerMetadata = Record<string, unknown>;

export interface ScoringResult {
  isCorrect: boolean;
  score: number; // 0.0 to 1.0 normalized
  reasoning?: string;
  /**
   * Scorer-specific details (extracted answer, judge model, sandbox outcome…).
   * `unscored: true` means the scorer could not produce a real verdict (judge unavailable,
   * sandbox could not start, question data missing). The runner must store the row for
   * traceability, EXCLUDE it from the accuracy denominator and count it in failure_rate —
   * exactly like a failed model call (rule 9).
   */
  metadata?: Record<string, unknown>;
}

/**
 * Optional per-question context a scorer may use in addition to the response/expected pair.
 * Only the LLM judge reads it today (it needs the original instruction to judge open-ended
 * answers). Scorers must behave correctly when it is omitted.
 */
export interface ScoringContext {
  /** The exact prompt that was sent to the model under evaluation. */
  prompt?: string;
}

export interface Scorer {
  name: string;
  score(
    response: string,
    expected: string,
    metadata?: ScorerMetadata,
    context?: ScoringContext
  ): ScoringResult | Promise<ScoringResult>;
}
