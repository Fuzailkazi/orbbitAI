/**
 * Catalog seed: models + benchmarks + spaces. Nothing else.
 *
 * This script never writes evaluations, evaluation_results or benchmark_questions.
 * Every score in Orbbit comes from a real run: import the real benchmark questions,
 * then run evaluations through the pipeline.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { benchmarks } from "./seed-benchmarks";
import { models } from "./seed-models";
import { spaces } from "./seed-spaces";

export const NEXT_STEPS_MESSAGE = "Next: pnpm db:import:questions --write, then pnpm eval:batch";

function createSeedClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Make sure .env.local is loaded (pnpm db:seed)."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function seedBenchmarks(supabase: SupabaseClient): Promise<{ id: string; name: string }[]> {
  console.log(`Seeding ${benchmarks.length} benchmarks...`);
  const { data, error } = await supabase
    .from("benchmarks")
    .upsert(benchmarks, { onConflict: "name" })
    .select("id, name");

  if (error) throw new Error(`Benchmark seed failed: ${error.message} (${error.code})`);
  console.log(`  ✓ ${data.length} benchmarks seeded`);
  return data;
}

async function seedModels(supabase: SupabaseClient): Promise<void> {
  console.log(`Seeding ${models.length} models...`);

  // Batch in chunks of 50 to stay well under the PostgREST payload limits.
  const batchSize = 50;
  let total = 0;

  for (let i = 0; i < models.length; i += batchSize) {
    const batch = models.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("models")
      .upsert(batch, { onConflict: "api_identifier" })
      .select("id");

    if (error) throw new Error(`Model seed failed (batch ${i}): ${error.message} (${error.code})`);
    total += data.length;
  }

  console.log(`  ✓ ${total} models seeded`);
}

async function seedSpaces(
  supabase: SupabaseClient,
  benchmarkData: { id: string; name: string }[]
): Promise<void> {
  console.log(`Seeding ${spaces.length} spaces...`);

  const benchmarkMap = new Map(benchmarkData.map((b) => [b.name, b.id]));
  let failures = 0;

  for (const space of spaces) {
    const benchmarkIds = space.benchmark_names
      .map((name) => benchmarkMap.get(name))
      .filter((id): id is string => id !== undefined);

    const { data: spaceData, error: spaceError } = await supabase
      .from("spaces")
      .upsert(
        {
          name: space.name,
          description: space.description,
          icon: space.icon,
          benchmark_ids: benchmarkIds,
        },
        { onConflict: "name" }
      )
      .select("id")
      .single();

    if (spaceError || !spaceData) {
      console.error(`  ✗ Space ${space.name}: ${spaceError?.message ?? "no row returned"}`);
      failures++;
      continue;
    }

    const { error: deleteError } = await supabase
      .from("space_benchmarks")
      .delete()
      .eq("space_id", spaceData.id);
    if (deleteError) {
      console.error(`  ✗ Space ${space.name} junction reset: ${deleteError.message}`);
      failures++;
      continue;
    }

    if (benchmarkIds.length === 0) continue;

    const { error: junctionError } = await supabase
      .from("space_benchmarks")
      .insert(benchmarkIds.map((benchmarkId) => ({ space_id: spaceData.id, benchmark_id: benchmarkId })));
    if (junctionError) {
      console.error(`  ✗ Space ${space.name} junction insert: ${junctionError.message}`);
      failures++;
    }
  }

  if (failures > 0) throw new Error(`${failures} space seed step(s) failed (see above).`);
  console.log(`  ✓ ${spaces.length} spaces seeded`);
}

/** Seeds the catalog (models, benchmarks, spaces). Never seeds scores or questions. */
export async function runCatalogSeed(): Promise<void> {
  const supabase = createSeedClient();
  const benchmarkData = await seedBenchmarks(supabase);
  await seedModels(supabase);
  await seedSpaces(supabase, benchmarkData);
}

if (/(^|[\\/])seed\.ts$/.test(process.argv[1] ?? "")) {
  console.log("🌱 Starting Orbbit catalog seed (models + benchmarks + spaces)...\n");
  runCatalogSeed()
    .then(() => {
      console.log("\n✅ Seed complete. No evaluation scores were seeded.");
      console.log(NEXT_STEPS_MESSAGE);
    })
    .catch((err: unknown) => {
      console.error("Seed failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
