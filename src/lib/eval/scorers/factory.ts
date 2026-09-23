import type { ScoringMethod } from "@/types/database";
import type { Scorer } from "../types";
import { ExactMatchScorer } from "./exact-match";
import { NormalizedMatchScorer } from "./normalized-match";
import { PassAtKScorer } from "./pass-at-k";
import { LLMJudgeScorer } from "./llm-judge";

/**
 * Scorer registry — the scoring method is declared by the benchmark (CLAUDE.md rule 10).
 * Add new scorers here; no if/else chains elsewhere.
 */
const SCORER_REGISTRY: Partial<Record<ScoringMethod, () => Scorer>> = {
  exact_match: () => new ExactMatchScorer(),
  normalized_match: () => new NormalizedMatchScorer(),
  pass_at_k: () => new PassAtKScorer(),
  llm_judge: () => new LLMJudgeScorer(),
};

export const SUPPORTED_SCORING_METHODS = Object.keys(SCORER_REGISTRY) as ScoringMethod[];

export function isSupportedScoringMethod(method: unknown): method is ScoringMethod {
  return typeof method === "string" && Object.prototype.hasOwnProperty.call(SCORER_REGISTRY, method);
}

export class UnsupportedScoringMethodError extends Error {
  constructor(method: string) {
    super(`Scoring method "${method}" has no registered scorer.`);
    this.name = "UnsupportedScoringMethodError";
  }
}

export function getScorer(method: string): Scorer {
  if (!isSupportedScoringMethod(method)) {
    throw new UnsupportedScoringMethodError(method);
  }
  const create = SCORER_REGISTRY[method];
  if (!create) throw new UnsupportedScoringMethodError(method);
  return create();
}
