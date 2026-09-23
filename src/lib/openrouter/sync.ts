import { createAdminClient } from "../supabase/admin";
import type { ModelCategory, ModelInsert } from "@/types/database";

export interface OpenRouterSyncResult {
  totalDiscovered: number;
  newModelsAdded: number;
  modelsUpdated: number;
  /** Rows that could not be written (batch upsert errors). */
  failedWrites: number;
  models: { name: string; vendor: string; api_identifier: string }[];
}

/** Subset of an entry in GET https://openrouter.ai/api/v1/models. Prices are $/token strings. */
export interface OpenRouterCatalogModel {
  id: string;
  name?: string;
  description?: string | null;
  context_length?: number | null;
  pricing?: {
    prompt?: string | number | null;
    completion?: string | number | null;
  } | null;
}

interface OpenRouterCatalogResponse {
  data?: unknown;
}

/** Sanity cap ($/1M). Real text models are far below this; guards against sentinel/overflow values. */
const MAX_PRICE_PER_MILLION = 999.99;
const MAX_CONTEXT_WINDOW = 2_147_483_647;
const UPSERT_BATCH_SIZE = 50;

function isCatalogModel(value: unknown): value is OpenRouterCatalogModel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

/** "$/token" string → "$/1M tokens", clamped to the column range, 4 decimals (no lossy 2dp rounding). */
function toPricePerMillion(perToken: string | number | null | undefined): number {
  const n = typeof perToken === "string" ? parseFloat(perToken) : perToken;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  const perMillion = Math.min(MAX_PRICE_PER_MILLION, n * 1_000_000);
  return Math.round(perMillion * 10_000) / 10_000;
}

function parseVendorAndCategory(modelId: string, name: string): { vendor: string; category: ModelCategory } {
  const parts = modelId.split("/");
  const vendorPrefix = parts[0] || "Unknown";

  const vendorMap: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    "meta-llama": "Meta",
    mistralai: "Mistral",
    deepseek: "DeepSeek",
    qwen: "Alibaba",
    cohere: "Cohere",
    microsoft: "Microsoft",
    amazon: "Amazon",
    "x-ai": "xAI",
    perplexity: "Perplexity",
  };

  const vendor = vendorMap[vendorPrefix.toLowerCase()] ||
    vendorPrefix.charAt(0).toUpperCase() + vendorPrefix.slice(1);

  const lower = (modelId + " " + name).toLowerCase();
  let category: ModelCategory = "chat";
  if (lower.includes("embed")) category = "embedding";
  else if (lower.includes("code") || lower.includes("coder")) category = "code";
  else if (lower.includes("vision") || lower.includes("vl") || lower.includes("image")) category = "vision";
  else if (lower.includes("reason") || lower.includes("r1") || lower.includes("o1") || lower.includes("o3") || lower.includes("thinking")) category = "reasoning";
  else if (lower.includes("moe") || lower.includes("mixtral") || lower.includes("scout") || lower.includes("maverick")) category = "moe";

  return { vendor, category };
}

export async function syncOpenRouterModels(): Promise<OpenRouterSyncResult> {
  const supabase = createAdminClient();

  // Fetch from OpenRouter public catalog API
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as OpenRouterCatalogResponse;
  const rawList: unknown[] = Array.isArray(json.data) ? json.data : [];

  // De-duplicate by id — a duplicate key inside one upsert statement is a Postgres error.
  const catalog = new Map<string, OpenRouterCatalogModel>();
  for (const entry of rawList) {
    if (isCatalogModel(entry)) catalog.set(entry.id, entry);
  }

  // Existing identifiers, to report new vs updated
  const { data: existingRows, error: existingErr } = await supabase.from("models").select("api_identifier");
  if (existingErr) {
    throw new Error(`Failed to read existing models: ${existingErr.message}`);
  }
  const existingIdentifiers = new Set(
    ((existingRows ?? []) as { api_identifier: string }[]).map((m) => m.api_identifier)
  );

  type SyncRow = Omit<ModelInsert, "release_date"> & { updated_at: string };
  const now = new Date().toISOString();
  const toUpsert: { row: SyncRow; isNew: boolean }[] = [];

  for (const item of catalog.values()) {
    const apiIdentifier = item.id;
    const displayName = item.name?.trim() || apiIdentifier;
    const { vendor, category } = parseVendorAndCategory(apiIdentifier, displayName);
    const rawContext =
      typeof item.context_length === "number" && item.context_length > 0 ? item.context_length : 8192;

    toUpsert.push({
      isNew: !existingIdentifiers.has(apiIdentifier),
      row: {
        name: displayName,
        vendor,
        category,
        context_window: Math.min(Math.round(rawContext), MAX_CONTEXT_WINDOW),
        pricing_input: toPricePerMillion(item.pricing?.prompt),
        pricing_output: toPricePerMillion(item.pricing?.completion),
        api_identifier: apiIdentifier,
        description: item.description?.slice(0, 300) || null,
        is_active: true,
        tags: [category, vendor.toLowerCase(), apiIdentifier.endsWith(":free") ? "free" : "commercial"],
        updated_at: now,
      },
    });
  }

  let newModelsAdded = 0;
  let modelsUpdated = 0;
  let failedWrites = 0;
  const newModelList: OpenRouterSyncResult["models"] = [];

  for (let i = 0; i < toUpsert.length; i += UPSERT_BATCH_SIZE) {
    const chunk = toUpsert.slice(i, i + UPSERT_BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from("models")
      .upsert(
        chunk.map((c) => c.row),
        { onConflict: "api_identifier" }
      );

    if (upsertErr) {
      console.error("OpenRouter sync batch upsert error:", upsertErr.message);
      failedWrites += chunk.length;
      continue;
    }

    for (const { row, isNew } of chunk) {
      if (isNew) {
        newModelsAdded++;
        newModelList.push({ name: row.name, vendor: row.vendor, api_identifier: row.api_identifier });
      } else {
        modelsUpdated++;
      }
    }
  }

  if (toUpsert.length > 0 && failedWrites === toUpsert.length) {
    throw new Error("OpenRouter sync failed: no models could be written to the database.");
  }

  return {
    totalDiscovered: catalog.size,
    newModelsAdded,
    modelsUpdated,
    failedWrites,
    models: newModelList.slice(0, 10),
  };
}
