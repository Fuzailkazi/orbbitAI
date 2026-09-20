import { Scorer } from "../types";
import { ExactMatchScorer } from "./exact-match";
import { NormalizedMatchScorer } from "./normalized-match";
import { PassAtKScorer } from "./pass-at-k";
import { LLMJudgeScorer } from "./llm-judge";

export function getScorer(method: string): Scorer {
  switch (method) {
    case "exact_match":
      return new ExactMatchScorer();
    case "normalized_match":
      return new NormalizedMatchScorer();
    case "pass_at_k":
      return new PassAtKScorer();
    case "llm_judge":
      return new LLMJudgeScorer();
    default:
      return new ExactMatchScorer();
  }
}
