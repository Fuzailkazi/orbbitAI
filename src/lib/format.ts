/**
 * Shared, pure display formatters. Safe to import from server and client components.
 * Every helper tolerates `null` / `undefined` / `NaN` and returns an em dash ("—").
 */
import { calculateWilsonConfidenceInterval } from "@/lib/eval/statistics";

const DASH = "—";

function isNum(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** 97.84 → "97.8%". `n` is already a 0–100 percentage. */
export function formatPct(n: number | null | undefined, digits = 1): string {
  if (!isNum(n)) return DASH;
  return `${n.toFixed(digits)}%`;
}

/** (96.1, 98.8) → "96.1–98.8" (percent points, no % sign). */
export function formatCI(
  lower: number | null | undefined,
  upper: number | null | undefined,
  digits = 1
): string {
  if (!isNum(lower) || !isNum(upper)) return DASH;
  return `${lower.toFixed(digits)}–${upper.toFixed(digits)}`;
}

/** Half-width of the interval: (96.1, 98.8) → "±1.4". */
export function formatCIMargin(
  lower: number | null | undefined,
  upper: number | null | undefined,
  digits = 1
): string {
  if (!isNum(lower) || !isNum(upper)) return DASH;
  return `±${((upper - lower) / 2).toFixed(digits)}`;
}

/**
 * USD with sensible precision; never shows "$0.00" for a non-zero value.
 * 0 → "$0", 0.000042 → "$0.000042", 0.0012 → "$0.0012", 0.25 → "$0.25", 1.2 → "$1.20", 1234.5 → "$1,234.50".
 */
export function formatCost(usd: number | null | undefined): string {
  if (!isNum(usd)) return DASH;
  if (usd === 0) return "$0";
  const sign = usd < 0 ? "-" : "";
  const abs = Math.abs(usd);
  if (abs >= 1) {
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (abs >= 0.01) return `${sign}$${abs.toFixed(2)}`;
  // Two significant digits for sub-cent values, trailing zeros trimmed.
  const digits = Math.min(8, Math.max(2, 1 - Math.floor(Math.log10(abs))));
  const fixed = abs.toFixed(digits).replace(/0+$/, "");
  return `${sign}$${fixed}`;
}

/** Model price per 1M tokens: 0 → "Free", 2.5 → "$2.50/M". */
export function formatPricePerMillion(usd: number | null | undefined): string {
  if (!isNum(usd)) return DASH;
  if (usd === 0) return "Free";
  return `${formatCost(usd)}/M`;
}

/** Compact counts: 950 → "950", 131072 → "131K", 1048576 → "1.05M", 2.5e9 → "2.5B". */
export function formatTokens(n: number | null | undefined): string {
  if (!isNum(n)) return DASH;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9, 2)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6, 2)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3, abs >= 1e5 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

/** Context window: 128000 → "128K", 1048576 → "1.05M". Alias of formatTokens. */
export function formatContext(n: number | null | undefined): string {
  return formatTokens(n);
}

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** 842 → "842ms", 1520 → "1.52s", 65000 → "1m 5s". */
export function formatLatency(ms: number | null | undefined): string {
  if (!isNum(ms)) return DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${trim(ms / 1000, ms < 10_000 ? 2 : 1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** 1234.5 → "1,235"; plain grouped integer. */
export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (!isNum(n)) return DASH;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Strips a leading "Vendor: " prefix that OpenRouter puts on many model names.
 * "OpenAI: GPT-4o" → "GPT-4o", "Anthropic: Claude Opus 4" → "Claude Opus 4". Display only.
 */
export function formatModelName(name: string | null | undefined): string {
  if (!name) return DASH;
  const stripped = name.replace(/^[^:]{2,40}:\s+/, "");
  return stripped || name;
}

const KNOWN_VENDORS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "google-deepmind": "Google DeepMind",
  deepseek: "DeepSeek",
  "deepseek-ai": "DeepSeek",
  "x-ai": "xAI",
  xai: "xAI",
  meta: "Meta",
  "meta-llama": "Meta",
  mistral: "Mistral",
  mistralai: "Mistral",
  qwen: "Qwen",
  alibaba: "Alibaba",
  cohere: "Cohere",
  microsoft: "Microsoft",
  nvidia: "NVIDIA",
  amazon: "Amazon",
  "aion-labs": "Aion Labs",
  ai21: "AI21",
  "01-ai": "01.AI",
  moonshotai: "Moonshot AI",
  "z-ai": "Z.ai",
  zhipu: "Zhipu",
  minimax: "MiniMax",
  perplexity: "Perplexity",
  inclusionai: "InclusionAI",
  nousresearch: "Nous Research",
  liquid: "Liquid",
  ibm: "IBM",
  "ibm-granite": "IBM",
  thudm: "THUDM",
  openrouter: "OpenRouter",
  bytedance: "ByteDance",
  baidu: "Baidu",
  tencent: "Tencent",
  inflection: "Inflection",
  arcee: "Arcee",
  "arcee-ai": "Arcee",
  sao10k: "Sao10K",
};

/**
 * Human vendor name from a slug or loosely-cased name.
 * "aion-labs" → "Aion Labs", "openai" → "OpenAI", "x-ai" → "xAI", "OpenAI" → "OpenAI".
 */
export function formatVendor(slug: string | null | undefined): string {
  // OpenRouter "latest" aliases prefix the vendor slug with "~" (e.g. "~openai").
  const clean = slug?.trim().replace(/^~+/, "") ?? "";
  if (!clean) return "Unknown";
  const key = clean.toLowerCase();
  const known = KNOWN_VENDORS[key] ?? KNOWN_VENDORS[key.replace(/\s+/g, "-")];
  if (known) return known;
  // Already human-cased (contains an uppercase letter and no separators) → keep.
  if (/[A-Z]/.test(clean) && !/[-_]/.test(clean)) return clean;
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface CISource {
  accuracy: number | null | undefined;
  accuracy_ci_lower?: number | null | undefined;
  accuracy_ci_upper?: number | null | undefined;
  questions_evaluated?: number | null | undefined;
  questions_correct?: number | null | undefined;
  /** 0–100; failed calls + unscored prompts, which are NOT in the accuracy denominator. */
  failure_rate?: number | null | undefined;
}

/**
 * Prompts with a real verdict — the accuracy / Wilson CI denominator.
 *
 * questions_evaluated counts every ATTEMPTED prompt, including failed model calls and prompts
 * the scorer could not grade; those are excluded from accuracy and counted in failure_rate
 * (runner.ts aggregateRun). The table has no questions_scored column, so the count is
 * recovered as attempted × (1 − failure_rate); failure_rate is stored to 0.1%, which is exact
 * after rounding for any sample below 1,000 prompts.
 */
export function scoredQuestionCount(row: Pick<CISource, "questions_evaluated" | "failure_rate">): number {
  const n = isNum(row.questions_evaluated) ? row.questions_evaluated : 0;
  if (n <= 0) return 0;
  const rate = isNum(row.failure_rate) ? Math.min(100, Math.max(0, row.failure_rate)) : 0;
  return Math.max(0, Math.round(n * (1 - rate / 100)));
}

export interface ResolvedCI {
  /** 0–100 percentage or null when unknown. */
  accuracy: number | null;
  /** Wilson 95% bounds (0–100) or null when neither stored nor computable. */
  lower: number | null;
  upper: number | null;
  /** Where the bounds came from. */
  source: "stored" | "computed" | "none";
}

/**
 * Returns stored Wilson bounds when present, otherwise computes them from
 * `questions_correct / scored prompts` (see scoredQuestionCount). Accuracy falls back to the
 * count ratio too.
 */
export function resolveCI(row: CISource): ResolvedCI {
  const n = scoredQuestionCount(row);
  const storedK = isNum(row.questions_correct) ? row.questions_correct : null;
  const accuracy = isNum(row.accuracy)
    ? row.accuracy
    : n > 0 && storedK !== null
      ? (storedK / n) * 100
      : null;
  // If only accuracy + sample size are known, back out the correct count.
  const k = storedK ?? (n > 0 && accuracy !== null ? Math.round((accuracy / 100) * n) : null);

  if (isNum(row.accuracy_ci_lower) && isNum(row.accuracy_ci_upper)) {
    return { accuracy, lower: row.accuracy_ci_lower, upper: row.accuracy_ci_upper, source: "stored" };
  }
  if (n > 0 && k !== null) {
    const ci = calculateWilsonConfidenceInterval(k, n);
    return { accuracy, lower: ci.lower, upper: ci.upper, source: "computed" };
  }
  return { accuracy, lower: null, upper: null, source: "none" };
}
