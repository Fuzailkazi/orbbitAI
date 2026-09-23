import { revalidateTag } from "next/cache";
import { CACHE_TAGS, type CacheTag } from "./tags";

/**
 * Cache invalidation for src/lib/data. Call AFTER a successful write, from a Route Handler or
 * Server Action — never during render or inside "use cache" (Next throws there).
 *
 * Uses `revalidateTag(tag, { expire: 0 })`: the entry expires immediately, so the next request
 * waits for fresh data (read-your-own-writes). `updateTag` would do the same but only works in
 * Server Actions, and every writer in this app is a Route Handler (or the CLI runner).
 *
 * Outside a Next request (e.g. `pnpm eval:batch` running the runner from the CLI) there is no
 * cache to invalidate: the helper logs a warning and returns false, and the cacheLife window
 * (5 min for evaluations) picks the change up.
 */
function expire(tags: readonly CacheTag[]): boolean {
  try {
    for (const tag of tags) revalidateTag(tag, { expire: 0 });
    return true;
  } catch (err) {
    console.warn(
      `[cache] Could not revalidate ${tags.join(", ")}; cached reads refresh on their cacheLife instead.`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/** After model sync (insert/update/deactivate). Also refreshes evaluation joins (model names). */
export function revalidateModels(): boolean {
  return expire([CACHE_TAGS.models]);
}

/** After an evaluation reaches `completed` (or a completed row is removed, e.g. a purge). */
export function revalidateEvaluations(): boolean {
  return expire([CACHE_TAGS.evaluations]);
}

/** After a space is created, edited or deleted. */
export function revalidateSpaces(): boolean {
  return expire([CACHE_TAGS.spaces]);
}

/** After a benchmark or its questions change (custom upload, question import, delete). */
export function revalidateBenchmarks(): boolean {
  return expire([CACHE_TAGS.benchmarks]);
}
