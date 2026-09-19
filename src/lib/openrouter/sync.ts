import { createClient } from "@supabase/supabase-js";
import type { ModelCategory } from "@/types/database";

export interface OpenRouterSyncResult {
  totalDiscovered: number;
  newModelsAdded: number;
  modelsUpdated: number;
  models: { name: string; vendor: string; api_identifier: string }[];
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase credentials for sync.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch from OpenRouter public API
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.statusText}`);
  }

  const json = await response.json();
  const rawModels: any[] = json.data || [];

  // Fetch existing models from Supabase
  const { data: existingRows } = await supabase.from("models").select("api_identifier");
  const existingIdentifiers = new Set((existingRows || []).map((m) => m.api_identifier));

  let newModelsAdded = 0;
  let modelsUpdated = 0;
  const newModelList: { name: string; vendor: string; api_identifier: string }[] = [];

  // Batch insert new models
  const toUpsert: any[] = [];

  for (const item of rawModels) {
    const apiIdentifier = item.id;
    const { vendor, category } = parseVendorAndCategory(apiIdentifier, item.name);

    // Convert pricing: OpenRouter returns price per token as string e.g. "0.000002"
    // We store as $/1M tokens
    const pricingInput = item.pricing?.prompt ? parseFloat(item.pricing.prompt) * 1_000_000 : 0;
    const pricingOutput = item.pricing?.completion ? parseFloat(item.pricing.completion) * 1_000_000 : 0;
    const contextWindow = item.context_length || 8192;

    const isNew = !existingIdentifiers.has(apiIdentifier);

    toUpsert.push({
      name: item.name || apiIdentifier,
      vendor,
      category,
      context_window: contextWindow,
      pricing_input: Math.round(pricingInput * 1000) / 1000,
      pricing_output: Math.round(pricingOutput * 1000) / 1000,
      api_identifier: apiIdentifier,
      description: item.description?.slice(0, 300) || null,
      is_active: true,
      tags: [category, vendor.toLowerCase(), item.id.includes(":free") ? "free" : "commercial"],
    });

    if (isNew) {
      newModelsAdded++;
      newModelList.push({ name: item.name || apiIdentifier, vendor, api_identifier: apiIdentifier });
    } else {
      modelsUpdated++;
    }
  }

  // Upsert in batches of 50
  for (let i = 0; i < toUpsert.length; i += 50) {
    const chunk = toUpsert.slice(i, i + 50);
    const { error: upsertErr } = await supabase
      .from("models")
      .upsert(chunk, { onConflict: "api_identifier" });

    if (upsertErr) {
      console.error("Batch upsert error:", upsertErr.message);
    }
  }

  return {
    totalDiscovered: rawModels.length,
    newModelsAdded,
    modelsUpdated,
    models: newModelList.slice(0, 10),
  };
}
