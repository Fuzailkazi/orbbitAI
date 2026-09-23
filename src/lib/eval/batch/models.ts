/**
 * Candidate ranking for `--models auto`: free, active models, preferring larger / well-known
 * models and one model per vendor. Pure — the CLI probes the ranked candidates afterwards.
 */

export interface CandidateModel {
  id: string;
  name: string;
  vendor: string;
  api_identifier: string;
  is_active: boolean;
  category: string;
  context_window: number | null;
  release_date: string | null;
}

/** Rough popularity of vendors on OpenRouter's free tier (higher = preferred). */
const VENDOR_WEIGHT: Record<string, number> = {
  meta: 10,
  "meta-llama": 10,
  google: 10,
  deepseek: 10,
  qwen: 9,
  alibaba: 9,
  mistral: 9,
  mistralai: 9,
  openai: 9,
  nvidia: 8,
  "z-ai": 8,
  moonshotai: 8,
  "x-ai": 8,
  cohere: 6,
  microsoft: 6,
};

/** Models that are not general-purpose text generators. */
const EXCLUDE_PATTERN = /content[-\s]?safety|guard|moderation|embed|rerank|\bvl\b|-vl[-:]|vision|omni|ocr/i;
const LARGE_TIER = /\b(ultra|pro|super|large|max)\b/i;
const SMALL_TIER = /\b(mini|nano|small|lite|tiny|xs|lightning)\b/i;

function vendorKey(model: Pick<CandidateModel, "api_identifier" | "vendor">): string {
  const prefix = model.api_identifier.split("/")[0]?.toLowerCase() ?? "";
  return prefix || model.vendor.toLowerCase();
}

/** Largest total parameter count (billions) named in the id, e.g. "120b-a12b" → 120; null if none. */
export function parseParamsBillions(apiIdentifier: string): number | null {
  const matches = [...apiIdentifier.toLowerCase().matchAll(/(?:^|[-_/.])(\d+(?:\.\d+)?)b(?=$|[-_:.])/g)];
  const values = matches.map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > 0);
  return values.length > 0 ? Math.max(...values) : null;
}

export function isAutoCandidate(model: CandidateModel): boolean {
  if (!model.is_active || !model.api_identifier.endsWith(":free")) return false;
  if (model.category === "embedding" || model.category === "vision") return false;
  if (EXCLUDE_PATTERN.test(`${model.api_identifier} ${model.name}`)) return false;
  const params = parseParamsBillions(model.api_identifier);
  return params === null || params >= 7;
}

/** Heuristic preference score (higher is better). */
export function autoModelScore(model: CandidateModel): number {
  const words = model.api_identifier.replace(/[-_/:.]/g, " ");
  const vendor = VENDOR_WEIGHT[vendorKey(model)] ?? 4;
  const params = parseParamsBillions(model.api_identifier);
  // Unknown size: assume a mid-size model, nudged by tier words.
  const sizeBillions = params ?? (LARGE_TIER.test(words) ? 100 : SMALL_TIER.test(words) ? 10 : 30);
  const sizeScore = Math.log2(Math.max(1, sizeBillions)) * 3;
  const tier = LARGE_TIER.test(words) ? 2 : SMALL_TIER.test(words) ? -3 : 0;
  const year = model.release_date ? Number(model.release_date.slice(0, 4)) : null;
  // Catalog rows without a release date are recent OpenRouter syncs.
  const recency = year === null || !Number.isFinite(year) ? 2 : Math.max(-4, Math.min(3, year - 2024));
  return vendor * 2 + sizeScore + tier + recency;
}

/**
 * Candidates in probe order: the best model of each vendor first (by score), then the
 * remaining models (by score) as fallbacks if probes fail.
 */
export function rankAutoCandidates(models: readonly CandidateModel[]): CandidateModel[] {
  const eligible = models.filter(isAutoCandidate).sort((a, b) => autoModelScore(b) - autoModelScore(a));
  const seen = new Set<string>();
  const firsts: CandidateModel[] = [];
  const rest: CandidateModel[] = [];
  for (const m of eligible) {
    const v = vendorKey(m);
    if (seen.has(v)) {
      rest.push(m);
    } else {
      seen.add(v);
      firsts.push(m);
    }
  }
  return [...firsts, ...rest];
}

/** Vendor key used for diversity (exported for the CLI's "one per vendor" check). */
export function modelVendorKey(model: Pick<CandidateModel, "api_identifier" | "vendor">): string {
  return vendorKey(model);
}
