/**
 * Cache tags for the shared data layer. Every cached function in src/lib/data tags its entry
 * with the tables it reads, and src/lib/data/revalidate.ts expires them when that data changes.
 */
export const CACHE_TAGS = {
  models: "models",
  benchmarks: "benchmarks",
  evaluations: "evaluations",
  spaces: "spaces",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Named cacheLife profiles defined in next.config.ts. */
export const CACHE_PROFILES = {
  /** Models, benchmarks, spaces — stale 5 min, revalidate 1 h, expire 1 day. */
  catalog: "catalog",
  /** Completed-evaluation aggregates — stale 30 s, revalidate 5 min, expire 1 day. */
  evaluations: "evaluations",
} as const;
