import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isUuid } from "@/lib/api/responses";
import type { Model } from "@/types/database";
import { CACHE_PROFILES, CACHE_TAGS } from "./tags";
import { DataQueryError, PG_INVALID_TEXT, toNumber } from "./shared";

/** Catalog / picker row: everything the list, compare and overview views show (no description, tags). */
export type CatalogModel = Pick<
  Model,
  | "id"
  | "name"
  | "vendor"
  | "category"
  | "context_window"
  | "pricing_input"
  | "pricing_output"
  | "api_identifier"
  | "release_date"
>;

/** Live-run picker row (`:free` models only). */
export type FreeModel = Pick<
  Model,
  "id" | "name" | "vendor" | "api_identifier" | "pricing_input" | "category" | "context_window"
>;

const CATALOG_COLUMNS =
  "id, name, vendor, category, context_window, pricing_input, pricing_output, api_identifier, release_date";
const FREE_COLUMNS = "id, name, vendor, api_identifier, pricing_input, category, context_window";
const MODEL_COLUMNS =
  "id, name, vendor, category, context_window, pricing_input, pricing_output, api_identifier, release_date, is_active, description, tags, created_at, updated_at";

function normalizeCatalog(row: CatalogModel): CatalogModel {
  return {
    ...row,
    context_window: toNumber(row.context_window),
    pricing_input: toNumber(row.pricing_input),
    pricing_output: toNumber(row.pricing_output),
  };
}

/** Every active model, sorted by name. Tag: models. Profile: catalog. */
export async function getActiveModels(): Promise<CatalogModel[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.models);

  const { data, error } = await createPublicClient()
    .from("models")
    .select(CATALOG_COLUMNS)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new DataQueryError("Failed to load models", error);
  return ((data ?? []) as CatalogModel[]).map(normalizeCatalog);
}

/**
 * Active `:free` models (the only ones that may run live — CLAUDE.md), sorted by vendor then
 * name. Tag: models. Profile: catalog.
 */
export async function getFreeModels(): Promise<FreeModel[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.models);

  const { data, error } = await createPublicClient()
    .from("models")
    .select(FREE_COLUMNS)
    .eq("is_active", true)
    .like("api_identifier", "%:free")
    .order("vendor", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new DataQueryError("Failed to load models", error);
  return ((data ?? []) as FreeModel[])
    .filter((m) => m.api_identifier.endsWith(":free"))
    .map((m) => ({
      ...m,
      context_window: toNumber(m.context_window),
      pricing_input: toNumber(m.pricing_input),
    }));
}

/**
 * One model, full row (description + tags included — the detail page shows them), active or not.
 * Returns null when the id is not a UUID or no row matches. Tag: models. Profile: catalog.
 */
export async function getModelById(id: string): Promise<Model | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.models);

  if (!isUuid(id)) return null;
  const { data, error } = await createPublicClient()
    .from("models")
    .select(MODEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === PG_INVALID_TEXT) return null;
    throw new DataQueryError("Failed to load model", error);
  }
  if (!data) return null;
  const row = data as Model;
  return {
    ...row,
    context_window: toNumber(row.context_window),
    pricing_input: toNumber(row.pricing_input),
    pricing_output: toNumber(row.pricing_output),
    tags: row.tags ?? [],
  };
}

export interface CatalogCounts {
  /** Active models. */
  models: number;
  benchmarks: number;
}

/** Head-only counts for headline stats (landing page). Tags: models, benchmarks. Profile: catalog. */
export async function getCatalogCounts(): Promise<CatalogCounts> {
  "use cache";
  cacheLife(CACHE_PROFILES.catalog);
  cacheTag(CACHE_TAGS.models, CACHE_TAGS.benchmarks);

  const supabase = createPublicClient();
  const [modelsRes, benchmarksRes] = await Promise.all([
    supabase.from("models").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("benchmarks").select("id", { count: "exact", head: true }),
  ]);
  if (modelsRes.error) throw new DataQueryError("Failed to count models", modelsRes.error);
  if (benchmarksRes.error) throw new DataQueryError("Failed to count benchmarks", benchmarksRes.error);
  return { models: modelsRes.count ?? 0, benchmarks: benchmarksRes.count ?? 0 };
}
