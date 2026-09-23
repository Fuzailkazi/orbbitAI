/**
 * Argument parsing for scripts/run-batch.ts (pure, unit-tested).
 *
 *   pnpm eval:batch --models auto|<id,id> --benchmarks <names>|runnable --n 100 --rpm 16
 *                   --daily-cap 900 [--dry-run] [--max-evals K] [--max-tokens T] [--concurrency C]
 */

import { EVAL_DEFAULT_CONCURRENCY, EVAL_DEFAULT_MAX_TOKENS, EVAL_MAX_CONCURRENCY } from "../limits";

export interface BatchArgs {
  /** "auto" or explicit model UUIDs / OpenRouter api_identifiers. */
  models: "auto" | string[];
  /** "runnable" or explicit benchmark names (case-insensitive) / UUIDs. */
  benchmarks: "runnable" | string[];
  n: number;
  rpm: number;
  dailyCap: number;
  dryRun: boolean;
  maxEvals: number | null;
  maxTokens: number;
  /** Prompts in flight at once per evaluation (starts are still paced by --rpm). */
  concurrency: number;
  /** Upper bound on models picked by --models auto. */
  autoModelCount: number;
}

export const BATCH_DEFAULTS = {
  n: 100,
  /** OpenRouter allows 20 req/min on :free models; 16 leaves headroom for clock skew and judge bursts. */
  rpm: 16,
  /**
   * Requests/day the batch may spend. OpenRouter allows 1000/day on :free models once the
   * account has bought ≥ 10 credits, 50/day otherwise; the CLI also clamps this to the key's
   * reported `free_model_daily_requests.limit`.
   */
  dailyCap: 900,
  autoModelCount: 6,
} as const;

/** Below this the gap between per-prompt inserts could approach the stall threshold. */
const MIN_RPM = 4;
const MAX_RPM = 20;

export class BatchArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchArgsError";
  }
}

export const BATCH_USAGE = `Usage: pnpm eval:batch [options]

  --models auto|<id,...>        "auto" picks up to 6 free models (probed); or model UUIDs / api_identifiers
  --benchmarks runnable|<n,...> "runnable" = benchmarks with imported questions; or names / UUIDs
  --n <int>                     questions per evaluation (default ${BATCH_DEFAULTS.n})
  --rpm <int>                   request pacing, ${MIN_RPM}-${MAX_RPM} (default ${BATCH_DEFAULTS.rpm})
  --daily-cap <int>             max requests per UTC day (default ${BATCH_DEFAULTS.dailyCap})
  --max-evals <int>             stop after K evaluations
  --max-tokens <int>            completion budget per prompt (default ${EVAL_DEFAULT_MAX_TOKENS})
  --concurrency <int>           prompts in flight at once, 1-${EVAL_MAX_CONCURRENCY} (default ${EVAL_DEFAULT_CONCURRENCY}); starts stay paced by --rpm
  --dry-run                     print the plan; no writes, no model calls
  --help                        show this help`;

function positiveInt(flag: string, raw: string | undefined, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (raw === undefined || raw.startsWith("--")) throw new BatchArgsError(`${flag} requires a value.`);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BatchArgsError(`${flag} must be an integer between ${min} and ${max} (got "${raw}").`);
  }
  return n;
}

function list(flag: string, raw: string | undefined): string[] {
  if (raw === undefined || raw.startsWith("--")) throw new BatchArgsError(`${flag} requires a value.`);
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) throw new BatchArgsError(`${flag} requires at least one value.`);
  return items;
}

/** Parses argv (without node/script). Returns null when --help was requested. */
export function parseBatchArgs(argv: readonly string[]): BatchArgs | null {
  const args: BatchArgs = {
    models: "auto",
    benchmarks: "runnable",
    n: BATCH_DEFAULTS.n,
    rpm: BATCH_DEFAULTS.rpm,
    dailyCap: BATCH_DEFAULTS.dailyCap,
    dryRun: false,
    maxEvals: null,
    maxTokens: EVAL_DEFAULT_MAX_TOKENS,
    concurrency: EVAL_DEFAULT_CONCURRENCY,
    autoModelCount: BATCH_DEFAULTS.autoModelCount,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const [flag, inline] = token.includes("=") ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)] : [token, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      i++;
      return argv[i];
    };
    switch (flag) {
      case "--help":
      case "-h":
        return null;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--models": {
        const items = list(flag, value());
        args.models = items.length === 1 && items[0].toLowerCase() === "auto" ? "auto" : items;
        break;
      }
      case "--benchmarks": {
        const items = list(flag, value());
        args.benchmarks = items.length === 1 && items[0].toLowerCase() === "runnable" ? "runnable" : items;
        break;
      }
      case "--n":
        args.n = positiveInt(flag, value(), 1, 5000);
        break;
      case "--rpm":
        args.rpm = positiveInt(flag, value(), MIN_RPM, MAX_RPM);
        break;
      case "--daily-cap":
        args.dailyCap = positiveInt(flag, value(), 1, 100_000);
        break;
      case "--max-evals":
        args.maxEvals = positiveInt(flag, value(), 1, 100_000);
        break;
      case "--max-tokens":
        args.maxTokens = positiveInt(flag, value(), 16, 32_768);
        break;
      case "--concurrency":
        args.concurrency = positiveInt(flag, value(), 1, EVAL_MAX_CONCURRENCY);
        break;
      default:
        throw new BatchArgsError(`Unknown argument "${token}".`);
    }
  }
  return args;
}
