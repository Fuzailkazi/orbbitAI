import { createClient } from "@supabase/supabase-js";
import { benchmarks } from "./seed-benchmarks";
import { models } from "./seed-models";
import { spaces } from "./seed-spaces";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Make sure .env.local is loaded. Run with: pnpm db:seed");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedBenchmarks() {
  console.log(`Seeding ${benchmarks.length} benchmarks...`);
  const { data, error } = await supabase
    .from("benchmarks")
    .upsert(benchmarks, { onConflict: "name" })
    .select("id, name");

  if (error) {
    console.error("Benchmark seed error:", error.message);
    process.exit(1);
  }
  console.log(`  ✓ ${data.length} benchmarks seeded`);
  return data;
}

async function seedModels() {
  console.log(`Seeding ${models.length} models...`);

  // Supabase has a row limit per insert, batch in chunks of 50
  const batchSize = 50;
  let total = 0;

  for (let i = 0; i < models.length; i += batchSize) {
    const batch = models.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("models")
      .upsert(batch, { onConflict: "api_identifier" })
      .select("id");

    if (error) {
      console.error(`Model seed error (batch ${i}):`, error.message);
      process.exit(1);
    }
    total += data.length;
  }

  console.log(`  ✓ ${total} models seeded`);
}

async function seedSpaces(benchmarkData: { id: string; name: string }[]) {
  console.log(`Seeding ${spaces.length} spaces...`);

  const benchmarkMap = new Map(benchmarkData.map((b) => [b.name, b.id]));

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

    if (spaceError) {
      console.error(`Space seed error (${space.name}):`, spaceError.message);
      continue;
    }

    // Seed space_benchmarks junction table
    const junctionRows = benchmarkIds.map((benchmarkId) => ({
      space_id: spaceData.id,
      benchmark_id: benchmarkId,
    }));

    if (junctionRows.length > 0) {
      // Delete existing entries for this space first
      await supabase
        .from("space_benchmarks")
        .delete()
        .eq("space_id", spaceData.id);

      const { error: junctionError } = await supabase
        .from("space_benchmarks")
        .insert(junctionRows);

      if (junctionError) {
        console.error(`Space-benchmark junction error (${space.name}):`, junctionError.message);
      }
    }
  }

  console.log(`  ✓ ${spaces.length} spaces seeded`);
}

async function main() {
  console.log("🌱 Starting Orbbit seed...\n");

  const benchmarkData = await seedBenchmarks();
  await seedModels();
  await seedSpaces(benchmarkData);

  console.log("\n✅ Seed complete!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
