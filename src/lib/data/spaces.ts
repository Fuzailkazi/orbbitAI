import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Benchmark, Space } from "@/types/database";
import { getBenchmarks } from "./benchmarks";
import { CACHE_PROFILES, CACHE_TAGS } from "./tags";
import { DataQueryError } from "./shared";

export type SpaceBenchmarkRef = Pick<Benchmark, "id" | "name" | "category">;

/** A space with its benchmarks resolved (in `benchmark_ids` order; unknown ids dropped). */
export type SpaceWithBenchmarks = Space & { benchmarks: SpaceBenchmarkRef[] };

const SPACE_COLUMNS = "id, name, description, icon, benchmark_ids, created_at";

/** Every space, newest first. Tag: spaces. Profile: catalog. */
export async function getSpaces(): Promise<Space[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.spaces);

  const { data, error } = await createPublicClient()
    .from("spaces")
    .select(SPACE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new DataQueryError("Failed to load spaces", error);
  return ((data ?? []) as Space[]).map((s) => ({ ...s, benchmark_ids: s.benchmark_ids ?? [] }));
}

/** Spaces joined to their benchmarks (both cached; see getSpaces / getBenchmarks). */
export async function getSpacesWithBenchmarks(): Promise<SpaceWithBenchmarks[]> {
  const [spaces, benchmarks] = await Promise.all([getSpaces(), getBenchmarks()]);
  const byId = new Map(benchmarks.map((b) => [b.id, { id: b.id, name: b.name, category: b.category }]));
  return spaces.map((space) => ({
    ...space,
    benchmarks: [...new Set(space.benchmark_ids)]
      .map((id) => byId.get(id))
      .filter((b): b is SpaceBenchmarkRef => Boolean(b)),
  }));
}
