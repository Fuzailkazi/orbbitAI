import { createServerClient } from "@/lib/supabase/server";
import { LeaderboardClient } from "./leaderboard-client";

export default async function LeaderboardPage() {
  const supabase = await createServerClient();

  const { data: evaluations, error } = await supabase
    .from("evaluations")
    .select("*, models(*), benchmarks(id, name, category)")
    .eq("status", "completed")
    .order("accuracy", { ascending: false });

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
      evaluations={evaluations ?? []}
      benchmarks={benchmarks ?? []}
    />
  );
}
