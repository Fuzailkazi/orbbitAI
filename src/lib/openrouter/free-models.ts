/**
 * Live evaluations run exclusively on OpenRouter's `:free` tier (CLAUDE.md → What NOT To Do).
 */
export const FREE_MODEL_SUFFIX = ":free";

/**
 * Default LLM-as-Judge model — must itself be a free-tier model. Free slugs come and go
 * (checked against GET https://openrouter.ai/api/v1/models on 2026-09-23); override with the
 * JUDGE_MODEL env var when this one leaves the free tier. The batch CLI probes it before any
 * llm_judge run and never lets a model judge its own answers.
 */
export const DEFAULT_JUDGE_MODEL = "google/gemma-4-31b-it:free";

export function isFreeModelId(apiIdentifier: string | null | undefined): boolean {
  return typeof apiIdentifier === "string" && apiIdentifier.trim().endsWith(FREE_MODEL_SUFFIX);
}

/** Honors JUDGE_MODEL only when it is a free-tier model; otherwise falls back to the default. */
export function resolveJudgeModel(candidate: string | null | undefined): string {
  return isFreeModelId(candidate) ? (candidate as string).trim() : DEFAULT_JUDGE_MODEL;
}
