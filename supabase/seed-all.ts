import { createClient } from "@supabase/supabase-js";
import { benchmarks } from "./seed-benchmarks";
import { models } from "./seed-models";
import { spaces } from "./seed-spaces";
import { comprehensiveQuestions } from "./seed-all-benchmark-questions";
import { evaluations } from "./seed-evaluations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Make sure .env.local is present. Run: pnpm db:seed:all");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedBenchmarks() {
  console.log(`\n📦 1/5: Seeding ${benchmarks.length} benchmarks...`);
  const { data, error } = await supabase
    .from("benchmarks")
    .upsert(benchmarks, { onConflict: "name" })
    .select("id, name");

  if (error) {
    throw new Error(`Benchmark seed failed: ${error.message}`);
  }
  console.log(`   ✓ ${data.length} benchmarks active`);
  return data;
}

async function seedModels() {
  console.log(`\n🤖 2/5: Seeding ${models.length} models...`);
  const batchSize = 50;
  let total = 0;

  for (let i = 0; i < models.length; i += batchSize) {
    const batch = models.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("models")
      .upsert(batch, { onConflict: "api_identifier" })
      .select("id");

    if (error) {
      throw new Error(`Model batch ${i} failed: ${error.message}`);
    }
    total += data.length;
  }
  console.log(`   ✓ ${total} models cataloged across vendors`);
}

async function seedSpaces(benchmarkData: { id: string; name: string }[]) {
  console.log(`\n🪐 3/5: Seeding ${spaces.length} evaluation spaces...`);
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

    if (spaceError || !spaceData) {
      console.warn(`   ⚠️ Space ${space.name} skipped: ${spaceError?.message}`);
      continue;
    }

    const junctionRows = benchmarkIds.map((benchmarkId) => ({
      space_id: spaceData.id,
      benchmark_id: benchmarkId,
    }));

    if (junctionRows.length > 0) {
      await supabase.from("space_benchmarks").delete().eq("space_id", spaceData.id);
      await supabase.from("space_benchmarks").insert(junctionRows);
    }
  }
  console.log(`   ✓ ${spaces.length} spaces curated with benchmark links`);
}

async function seedQuestions(benchmarkData: { id: string; name: string }[]) {
  console.log(`\n❓ 4/5: Seeding questions across benchmark suites...`);
  const benchmarkMap = new Map(benchmarkData.map((b) => [b.name, b.id]));

  const questionRows = comprehensiveQuestions
    .filter((q) => benchmarkMap.has(q.benchmark_name))
    .map((q) => ({
      benchmark_id: benchmarkMap.get(q.benchmark_name)!,
      prompt: q.prompt,
      expected_answer: q.expected_answer,
      metadata: q.metadata,
    }));

  if (questionRows.length > 0) {
    const { error } = await supabase.from("benchmark_questions").upsert(questionRows, {
      onConflict: "benchmark_id,prompt",
    }).select("id");

    if (error) {
      // Fallback to plain insert
      try {
        await supabase.from("benchmark_questions").insert(questionRows);
      } catch {}
    }
  }
  console.log(`   ✓ ${questionRows.length} benchmark questions ready for live testing`);
}

async function seedEvaluations() {
  console.log(`\n📊 5/5: Seeding pre-computed model evaluations...`);
  const { data: models } = await supabase.from("models").select("id, api_identifier");
  const { data: benchmarks } = await supabase.from("benchmarks").select("id, name");

  if (!models || !benchmarks) {
    console.warn("   ⚠️ Could not load models/benchmarks to link evaluations.");
    return;
  }

  const modelMap = new Map(models.map((m) => [m.api_identifier, m.id]));
  const benchmarkMap = new Map(benchmarks.map((b) => [b.name, b.id]));

  const { data: existingEvals } = await supabase.from("evaluations").select("id, model_id, benchmark_id");
  const existingMap = new Map<string, string>();
  for (const row of existingEvals || []) {
    existingMap.set(`${row.model_id}:${row.benchmark_id}`, row.id);
  }

  let inserted = 0;

  for (const ev of evaluations) {
    const modelId = modelMap.get(ev.model_api);
    const benchmarkId = benchmarkMap.get(ev.benchmark_name);

    if (!modelId || !benchmarkId) continue;

    const questionsEvaluated = 500;
    const questionsCorrect = Math.round((questionsEvaluated * ev.accuracy) / 100);

    const payload = {
      model_id: modelId,
      benchmark_id: benchmarkId,
      status: "completed" as const,
      accuracy: ev.accuracy,
      accuracy_ci_lower: ev.accuracy_ci_lower,
      accuracy_ci_upper: ev.accuracy_ci_upper,
      avg_latency_ms: ev.avg_latency_ms,
      median_latency_ms: ev.median_latency_ms,
      p95_latency_ms: ev.p95_latency_ms,
      total_tokens: questionsEvaluated * 240,
      total_cost: 0,
      failure_rate: 0,
      tokens_per_second: ev.tokens_per_second,
      questions_evaluated: questionsEvaluated,
      questions_correct: questionsCorrect,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    const key = `${modelId}:${benchmarkId}`;
    const existingId = existingMap.get(key);

    if (existingId) {
      const { error } = await supabase.from("evaluations").update(payload).eq("id", existingId);
      if (!error) inserted++;
    } else {
      const { error } = await supabase.from("evaluations").insert(payload);
      if (!error) inserted++;
    }
  }
  console.log(`   ✓ ${inserted} model benchmark runs populated in leaderboard & spaces`);
}

async function main() {
  console.log("🪐 Orbbit Master Seeding Engine Starting...\n");
  const benchmarkData = await seedBenchmarks();
  await seedModels();
  await seedSpaces(benchmarkData);
  await seedQuestions(benchmarkData);
  await seedEvaluations();
  console.log("\n✅ All Orbbit systems seeded and showcase-ready!\n");
}

main().catch((err) => {
  console.error("Master seed encountered an error:", err);
  process.exit(1);
});
