import { createServerClient } from "@/lib/supabase/server";
import type { Model } from "@/types/database";
import { LeaderboardClient } from "./leaderboard-client";

export default async function LeaderboardPage() {
  const supabase = await createServerClient();

  const { data: models, error } = await supabase
    .from("models")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: benchmarks } = await supabase
    .from("benchmarks")
    .select("id, name, category")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-red-500">Failed to load data: {error.message}</p>
      </div>
    );
  }

  return (
    <LeaderboardClient
      models={(models as Model[]) ?? []}
      benchmarks={benchmarks ?? []}
    />
  );
}
