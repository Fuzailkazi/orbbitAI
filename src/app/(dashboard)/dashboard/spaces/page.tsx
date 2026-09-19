import { createServerClient } from "@/lib/supabase/server";
import { SpacesClient } from "./spaces-client";
import type { Space, Benchmark } from "@/types/database";

export default async function SpacesPage() {
  const supabase = await createServerClient();
  const { data: spaces } = await supabase.from("spaces").select("*").order("created_at", { ascending: false });
  const { data: benchmarks } = await supabase.from("benchmarks").select("id, name, category").order("name");
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("benchmark_id, accuracy, models(name)")
    .eq("status", "completed");

  const benchmarkMap = new Map((benchmarks ?? []).map((b) => [b.id, b.name]));

  const spaceStats = (spaces ?? []).map((space) => {
    const ids: string[] = space.benchmark_ids ?? [];
    const names = ids.map((id) => benchmarkMap.get(id)).filter((n): n is string => Boolean(n));
    const evals = (evaluations ?? []).filter((e) => ids.includes(e.benchmark_id));
    const avg = evals.length > 0 ? evals.reduce((s, e) => s + (e.accuracy ?? 0), 0) / evals.length : null;
    const top = evals.length > 0 ? evals.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0] : null;
    return { space: space as Space, names, count: evals.length, avg, top };
  });

  return (
    <SpacesClient
      spaces={(spaces ?? []) as Space[]}
      benchmarks={(benchmarks ?? []) as Benchmark[]}
      spaceStats={spaceStats}
    />
  );
}
