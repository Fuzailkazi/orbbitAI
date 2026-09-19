import { createServerClient } from "@/lib/supabase/server";
import { EvaluateClient } from "./evaluate-client";
import { Play } from "lucide-react";
import type { Model, Benchmark } from "@/types/database";

export default async function EvaluatePage() {
  const supabase = await createServerClient();

  // Fetch active models
  const { data: models } = await supabase
    .from("models")
    .select("*")
    .order("vendor", { ascending: true })
    .order("name", { ascending: true });

  // Fetch benchmarks and question counts
  const { data: benchmarks } = await supabase
    .from("benchmarks")
    .select("*, benchmark_questions(count)")
    .order("name", { ascending: true });

  const activeBenchmarks = (benchmarks ?? []).map((b: any) => ({
    ...b,
    available_questions: b.benchmark_questions?.[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Play className="h-4 w-4 fill-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Run Model Evaluation
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Execute live standardized benchmark tests against any model in the catalog. Telemetry, latency distributions, and statistical confidence intervals will be recorded automatically.
        </p>
      </div>

      <EvaluateClient
        models={(models ?? []) as Model[]}
        benchmarks={activeBenchmarks as any[]}
      />
    </div>
  );
}
