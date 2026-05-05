import { createClient } from "@supabase/supabase-js";
import { evaluations } from "./seed-evaluations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Run with: tsx --env-file=.env.local supabase/seed-eval-runner.ts");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("🔬 Seeding evaluation data...\n");

  // Get model and benchmark maps
  const { data: models } = await supabase.from("models").select("id, api_identifier");
  const { data: benchmarks } = await supabase.from("benchmarks").select("id, name");

  if (!models || !benchmarks) {
    console.error("Failed to fetch models or benchmarks");
    process.exit(1);
  }

  const modelMap = new Map(models.map((m) => [m.api_identifier, m.id]));
  const benchmarkMap = new Map(benchmarks.map((b) => [b.name, b.id]));

  let inserted = 0;
  let skipped = 0;

  for (const ev of evaluations) {
    const modelId = modelMap.get(ev.model_api);
    const benchmarkId = benchmarkMap.get(ev.benchmark_name);

    if (!modelId || !benchmarkId) {
      console.log(`  Skip: ${ev.model_api} / ${ev.benchmark_name} (not found)`);
      skipped++;
      continue;
    }

    const questionsEvaluated = 500;
    const questionsCorrect = Math.round(questionsEvaluated * ev.accuracy / 100);
    const totalTokens = questionsEvaluated * 250;
    const totalCost = 0; // seeded data, no actual cost

    const { error } = await supabase.from("evaluations").upsert(
      {
        model_id: modelId,
        benchmark_id: benchmarkId,
        status: "completed",
        accuracy: ev.accuracy,
        accuracy_ci_lower: ev.accuracy_ci_lower,
        accuracy_ci_upper: ev.accuracy_ci_upper,
        avg_latency_ms: ev.avg_latency_ms,
        median_latency_ms: ev.median_latency_ms,
        p95_latency_ms: ev.p95_latency_ms,
        total_tokens: totalTokens,
        total_cost: totalCost,
        failure_rate: 0,
        tokens_per_second: ev.tokens_per_second,
        questions_evaluated: questionsEvaluated,
        questions_correct: questionsCorrect,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      { onConflict: "model_id,benchmark_id" }
    );

    if (error) {
      // If upsert on conflict fails (no unique constraint), try insert
      const { error: insertError } = await supabase.from("evaluations").insert({
        model_id: modelId,
        benchmark_id: benchmarkId,
        status: "completed",
        accuracy: ev.accuracy,
        accuracy_ci_lower: ev.accuracy_ci_lower,
        accuracy_ci_upper: ev.accuracy_ci_upper,
        avg_latency_ms: ev.avg_latency_ms,
        median_latency_ms: ev.median_latency_ms,
        p95_latency_ms: ev.p95_latency_ms,
        total_tokens: totalTokens,
        total_cost: totalCost,
        failure_rate: 0,
        tokens_per_second: ev.tokens_per_second,
        questions_evaluated: questionsEvaluated,
        questions_correct: questionsCorrect,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error(`  Error: ${ev.model_api} / ${ev.benchmark_name}: ${insertError.message}`);
        continue;
      }
    }

    inserted++;
  }

  console.log(`\n✅ Done: ${inserted} evaluations inserted, ${skipped} skipped`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
