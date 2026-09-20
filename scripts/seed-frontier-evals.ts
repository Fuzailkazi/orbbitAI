import { createClient } from "@supabase/supabase-js";
import { evaluations } from "../supabase/seed-evaluations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Fetching models and benchmarks from Supabase...");
  const { data: models, error: mErr } = await supabase.from("models").select("id, api_identifier");
  const { data: benchmarks, error: bErr } = await supabase.from("benchmarks").select("id, name");

  if (mErr || bErr || !models || !benchmarks) {
    console.error("Failed to fetch models or benchmarks:", mErr, bErr);
    process.exit(1);
  }

  const modelMap = new Map(models.map((m) => [m.api_identifier, m.id]));
  const benchmarkMap = new Map(benchmarks.map((b) => [b.name, b.id]));

  // Clean up any old provisional evaluations with < 10 questions for ling-3.0-flash-sante
  const lingId = modelMap.get("inclusionai/ling-3.0-flash-sante:free");
  if (lingId) {
    console.log("Cleaning up micro-sample evaluations for Ling 3.0...");
    await supabase.from("evaluations").delete().eq("model_id", lingId).lt("questions_evaluated", 10);
  }

  // Fetch all existing evaluations to decide insert vs update
  const { data: existingEvals } = await supabase.from("evaluations").select("id, model_id, benchmark_id");
  const existingMap = new Map<string, string>();
  for (const row of existingEvals || []) {
    existingMap.set(`${row.model_id}:${row.benchmark_id}`, row.id);
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const ev of evaluations) {
    const modelId = modelMap.get(ev.model_api);
    const benchmarkId = benchmarkMap.get(ev.benchmark_name);

    if (!modelId || !benchmarkId) {
      continue;
    }

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
      if (!error) {
        updatedCount++;
      } else {
        console.warn(`Update failed for ${ev.model_api} on ${ev.benchmark_name}:`, error.message);
      }
    } else {
      const { error } = await supabase.from("evaluations").insert(payload);
      if (!error) {
        insertedCount++;
      } else {
        console.warn(`Insert failed for ${ev.model_api} on ${ev.benchmark_name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Done! Inserted: ${insertedCount}, Updated: ${updatedCount} evaluations.`);
}

run().catch(console.error);
