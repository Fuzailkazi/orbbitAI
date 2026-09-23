import { cacheLife, cacheTag } from "next/cache";
import {
  CACHE_PROFILES,
  CACHE_TAGS,
  getCatalogCounts,
  getCompletedEvaluations,
  type CompletedEvaluation,
} from "@/lib/data";
import { formatModelName, formatVendor, resolveCI, scoredQuestionCount } from "@/lib/format";
import { CATEGORY_ORDER } from "./shared";
import type {
  ArenaBenchmark,
  ArenaCategory,
  ArenaMatchup,
  ArenaModel,
  HeroBoard,
  LandingShowcase,
  LandingStats,
} from "./types";

/** Evaluations with fewer graded prompts than this are too noisy to feature on the landing page. */
const MIN_SAMPLE = 30;
/** Benchmarks the hero card prefers (the MMLU / HumanEval toggle); others fill in when missing. */
const HERO_PREFERRED = ["MMLU", "HumanEval"] as const;
const HERO_BOARD_COUNT = 2;
const HERO_TOP_N = 5;
/** A matchup needs at least this many benchmarks both models completed. */
const MIN_SHARED = 2;

/** One featured-quality evaluation (latest completed run per model × benchmark). */
interface EvalPoint {
  evaluationId: string;
  benchmarkId: string;
  benchmarkName: string;
  category: ArenaCategory;
  description: string;
  accuracy: number;
  lower: number | null;
  upper: number | null;
  n: number;
  medianLatencyMs: number | null;
  tokensPerSecond: number | null;
  timestamp: string;
}

interface ModelAgg {
  id: string;
  name: string;
  shortName: string;
  lab: string;
  vendor: string;
  apiIdentifier: string;
  pricingInput: number | null;
  contextWindow: number | null;
  evals: Map<string, EvalPoint>;
}

/** Latency / throughput of 0 means "not recorded" (failed or synthetic rows), not "instant". */
function positive(n: number | null): number | null {
  return n !== null && n > 0 ? n : null;
}

/** Compact label for chips and delta badges: drops "(free)" style suffixes and preview dates. */
function shortModelName(raw: string): string {
  const name = formatModelName(raw);
  const short = name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+Preview\b.*$/i, "")
    .replace(/\s+Instruct\b.*$/i, "")
    .trim();
  return short || name;
}

function toCategory(dbCategory: string): ArenaCategory {
  switch (dbCategory) {
    case "code":
      return "Code";
    case "math":
      return "Math";
    case "reasoning":
    case "science":
      return "Reasoning";
    case "chat":
    case "agentic":
      return "Chat";
    default:
      return "Knowledge";
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Model families that publish open weights (matched on the OpenRouter identifier). */
const OPEN_WEIGHT_PREFIXES = [
  "meta-llama/",
  "deepseek/",
  "qwen/",
  "google/gemma",
  "microsoft/phi",
  "mistralai/mistral-7b",
  "mistralai/mixtral",
  "mistralai/mistral-nemo",
  "nousresearch/",
  "allenai/",
] as const;

function isOpenWeights(apiIdentifier: string): boolean {
  const id = apiIdentifier.toLowerCase();
  return OPEN_WEIGHT_PREFIXES.some((p) => id.startsWith(p));
}

/**
 * Completion order (oldest first, id as tie-break): makes every tie below — equal accuracy,
 * equal mean, equal price — resolve deterministically instead of by database row order.
 */
function byCompletion(a: CompletedEvaluation, b: CompletedEvaluation): number {
  const ta = a.completed_at ?? a.created_at;
  const tb = b.completed_at ?? b.created_at;
  return ta < tb ? -1 : ta > tb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildModels(evaluations: readonly CompletedEvaluation[]): ModelAgg[] {
  const models = new Map<string, ModelAgg>();
  for (const row of [...evaluations].sort(byCompletion)) {
    const model = row.models;
    const benchmark = row.benchmarks;
    if (!model || !benchmark) continue;

    // Graded prompts only: failed calls / unscored prompts are not in the accuracy denominator.
    const n = scoredQuestionCount({
      questions_evaluated: row.questions_evaluated,
      failure_rate: row.failure_rate,
    });
    if (n < MIN_SAMPLE) continue;
    const ci = resolveCI({
      accuracy: row.accuracy,
      accuracy_ci_lower: row.accuracy_ci_lower,
      accuracy_ci_upper: row.accuracy_ci_upper,
      questions_evaluated: n,
      questions_correct: row.questions_correct,
    });
    // Rule 1: never feature a score that can't carry its interval.
    if (ci.accuracy === null || ci.lower === null || ci.upper === null) continue;

    let agg = models.get(model.id);
    if (!agg) {
      agg = {
        id: model.id,
        name: formatModelName(model.name),
        shortName: shortModelName(model.name),
        lab: formatVendor(model.vendor),
        vendor: model.vendor,
        apiIdentifier: model.api_identifier,
        pricingInput: model.pricing_input,
        contextWindow: positive(model.context_window),
        evals: new Map(),
      };
      models.set(model.id, agg);
    }

    const point: EvalPoint = {
      evaluationId: row.id,
      benchmarkId: benchmark.id,
      benchmarkName: benchmark.name,
      category: toCategory(benchmark.category),
      description: benchmark.description ?? "",
      accuracy: ci.accuracy,
      lower: ci.lower,
      upper: ci.upper,
      n,
      medianLatencyMs: positive(row.median_latency_ms),
      tokensPerSecond: positive(row.tokens_per_second),
      timestamp: row.completed_at ?? row.created_at,
    };
    // Scores are immutable; a re-run is a new row, so the latest completed run is canonical.
    const existing = agg.evals.get(benchmark.id);
    if (!existing || point.timestamp > existing.timestamp) agg.evals.set(benchmark.id, point);
  }
  return [...models.values()];
}

function buildHeroBoards(models: ModelAgg[]): HeroBoard[] {
  const byBenchmark = new Map<string, { name: string; entries: { model: ModelAgg; point: EvalPoint }[] }>();
  for (const model of models) {
    for (const point of model.evals.values()) {
      const bucket = byBenchmark.get(point.benchmarkId) ?? { name: point.benchmarkName, entries: [] };
      bucket.entries.push({ model, point });
      byBenchmark.set(point.benchmarkId, bucket);
    }
  }

  const buckets = [...byBenchmark.values()].filter((b) => b.entries.length >= 2);
  const preferred = HERO_PREFERRED.map((name) => buckets.find((b) => b.name === name)).filter(
    (b): b is (typeof buckets)[number] => b !== undefined
  );
  const rest = buckets
    .filter((b) => !preferred.includes(b))
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));

  return [...preferred, ...rest].slice(0, HERO_BOARD_COUNT).map((bucket) => ({
    benchmark: bucket.name,
    rows: [...bucket.entries]
      .sort((a, b) => b.point.accuracy - a.point.accuracy)
      .slice(0, HERO_TOP_N)
      .map(({ model, point }) => ({
        evaluationId: point.evaluationId,
        name: model.name,
        lab: model.lab,
        vendor: model.vendor,
        accuracy: point.accuracy,
        lower: point.lower,
        upper: point.upper,
        n: point.n,
      })),
  }));
}

function sharedBenchmarkIds(a: ModelAgg, b: ModelAgg): string[] {
  return [...a.evals.keys()].filter((id) => b.evals.has(id));
}

function meanAccuracy(m: ModelAgg): number {
  return mean([...m.evals.values()].map((e) => e.accuracy)) ?? 0;
}

function modelP50(m: ModelAgg, benchmarkIds?: string[]): number | null {
  const points = benchmarkIds ? benchmarkIds.map((id) => m.evals.get(id)) : [...m.evals.values()];
  return median(points.flatMap((p) => (p && p.medianLatencyMs !== null ? [p.medianLatencyMs] : [])));
}

function modelThroughput(m: ModelAgg, benchmarkIds: string[]): number | null {
  return mean(
    benchmarkIds.flatMap((id) => {
      const tps = m.evals.get(id)?.tokensPerSecond;
      return tps !== null && tps !== undefined ? [tps] : [];
    })
  );
}

interface MatchupCriterion {
  id: string;
  badge: string;
  subtitle: string;
  /** Rank label shown on each model chip, e.g. "#1 fastest". */
  rankLabel: (rank: number) => string;
  rank: (models: ModelAgg[]) => ModelAgg[];
}

const CRITERIA: MatchupCriterion[] = [
  {
    id: "top-accuracy",
    badge: "Top Accuracy",
    subtitle: "The two highest mean-accuracy models that share completed suites",
    rankLabel: (r) => `#${r} mean accuracy`,
    rank: (models) =>
      models.filter((m) => m.evals.size >= 3).sort((a, b) => meanAccuracy(b) - meanAccuracy(a)),
  },
  {
    id: "fastest",
    badge: "Speed Leaders",
    subtitle: "Lowest median response latency across completed evaluations",
    rankLabel: (r) => `#${r} fastest`,
    rank: (models) =>
      models
        .filter((m) => modelP50(m) !== null)
        .sort((a, b) => (modelP50(a) ?? Infinity) - (modelP50(b) ?? Infinity)),
  },
  {
    id: "cheapest",
    badge: "Cost Efficient",
    subtitle: "Lowest input-token price among evaluated models",
    rankLabel: (r) => `#${r} lowest price`,
    rank: (models) =>
      models
        .filter((m) => m.pricingInput !== null)
        .sort(
          (a, b) =>
            (a.pricingInput ?? Infinity) - (b.pricingInput ?? Infinity) || meanAccuracy(b) - meanAccuracy(a)
        ),
  },
  {
    id: "open-weights",
    badge: "Open Weights",
    subtitle: "Highest mean accuracy among open-weight model families",
    rankLabel: (r) => `#${r} open weights`,
    rank: (models) =>
      models.filter((m) => isOpenWeights(m.apiIdentifier)).sort((a, b) => meanAccuracy(b) - meanAccuracy(a)),
  },
];

function toArenaModel(m: ModelAgg, rankLabel: string): ArenaModel {
  return { id: m.id, name: m.name, shortName: m.shortName, lab: m.lab, vendor: m.vendor, badge: rankLabel };
}

function buildMatchups(models: ModelAgg[]): ArenaMatchup[] {
  const usedPairs = new Set<string>();
  const matchups: ArenaMatchup[] = [];

  for (const criterion of CRITERIA) {
    const ranked = criterion.rank(models);
    let found: { a: number; b: number; shared: string[] } | null = null;

    for (let i = 0; i < ranked.length && !found; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        const key = [ranked[i].id, ranked[j].id].sort().join(":");
        if (usedPairs.has(key)) continue;
        const shared = sharedBenchmarkIds(ranked[i], ranked[j]);
        if (shared.length >= MIN_SHARED) {
          found = { a: i, b: j, shared };
          usedPairs.add(key);
          break;
        }
      }
    }
    if (!found) continue;

    const a = ranked[found.a];
    const b = ranked[found.b];
    const benchmarks: ArenaBenchmark[] = found.shared
      .map((id) => {
        const pa = a.evals.get(id);
        const pb = b.evals.get(id);
        if (!pa || !pb) return null;
        return {
          benchmarkId: id,
          name: pa.benchmarkName,
          category: pa.category,
          description: pa.description,
          a: { evaluationId: pa.evaluationId, accuracy: pa.accuracy, lower: pa.lower, upper: pa.upper, n: pa.n },
          b: { evaluationId: pb.evaluationId, accuracy: pb.accuracy, lower: pb.lower, upper: pb.upper, n: pb.n },
        };
      })
      .filter((x): x is ArenaBenchmark => x !== null)
      .sort(
        (x, y) =>
          CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) || x.name.localeCompare(y.name)
      );

    matchups.push({
      id: criterion.id,
      badge: criterion.badge,
      title: `${a.name} vs ${b.name}`,
      subtitle: criterion.subtitle,
      modelA: toArenaModel(a, criterion.rankLabel(found.a + 1)),
      modelB: toArenaModel(b, criterion.rankLabel(found.b + 1)),
      specs: {
        latencyA: modelP50(a, found.shared),
        latencyB: modelP50(b, found.shared),
        priceA: a.pricingInput,
        priceB: b.pricingInput,
        contextA: a.contextWindow,
        contextB: b.contextWindow,
        throughputA: modelThroughput(a, found.shared),
        throughputB: modelThroughput(b, found.shared),
      },
      benchmarks,
    });
  }
  return matchups;
}

interface ShowcaseData {
  showcase: LandingShowcase;
  avgCiHalfWidth: number | null;
}

const UNAVAILABLE: ShowcaseData = {
  showcase: { status: "unavailable", heroBoards: [], matchups: [] },
  avgCiHalfWidth: null,
};

/**
 * Hero boards + arena matchups derived from the shared completed-evaluations cache entry. Cached
 * itself (same profile and tags) so a request only does a cache lookup, never the aggregation.
 * Throws when the data can't be loaded; errors are never cached.
 */
async function buildShowcase(): Promise<ShowcaseData> {
  "use cache";
  cacheLife(CACHE_PROFILES.evaluations);
  cacheTag(CACHE_TAGS.evaluations, CACHE_TAGS.models, CACHE_TAGS.benchmarks);

  const models = buildModels(await getCompletedEvaluations());
  const halfWidths = models.flatMap((m) =>
    [...m.evals.values()].flatMap((e) => (e.lower !== null && e.upper !== null ? [(e.upper - e.lower) / 2] : []))
  );
  const heroBoards = buildHeroBoards(models);
  const matchups = buildMatchups(models);
  return {
    showcase: { status: heroBoards.length || matchups.length ? "ok" : "empty", heroBoards, matchups },
    avgCiHalfWidth: mean(halfWidths),
  };
}

async function getShowcase(): Promise<ShowcaseData> {
  try {
    return await buildShowcase();
  } catch {
    // Database unreachable: render the landing page with an honest "unavailable" state, never fake numbers.
    return UNAVAILABLE;
  }
}

async function getCounts(): Promise<Pick<LandingStats, "models" | "benchmarks">> {
  try {
    return await getCatalogCounts();
  } catch {
    // Landing must render even if the database is unreachable; the page falls back to generic copy.
    return { models: null, benchmarks: null };
  }
}

/** Everything the landing page shows that comes from the database (all cached, no request data). */
export async function getLandingData(): Promise<{ stats: LandingStats; showcase: LandingShowcase }> {
  const [counts, { showcase, avgCiHalfWidth }] = await Promise.all([getCounts(), getShowcase()]);
  return { stats: { ...counts, avgCiHalfWidth }, showcase };
}
