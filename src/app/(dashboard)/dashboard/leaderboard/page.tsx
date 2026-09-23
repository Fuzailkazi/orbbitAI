import type { Metadata } from "next";
import { getCompletedEvaluations, type CompletedEvaluation } from "@/lib/data";
import { LeaderboardClient, type EvalRow } from "./leaderboard-client";

export const metadata: Metadata = {
  title: "Leaderboard",
};

/** Trims a cached evaluation to the columns the leaderboard renders (keeps the RSC payload small). */
function toEvalRow(ev: CompletedEvaluation): EvalRow | null {
  // Rows without their joins can't be ranked (the client drops them too); skip them here.
  if (!ev.models || !ev.benchmarks) return null;
  return {
    id: ev.id,
    accuracy: ev.accuracy,
    accuracy_ci_lower: ev.accuracy_ci_lower,
    accuracy_ci_upper: ev.accuracy_ci_upper,
    avg_latency_ms: ev.avg_latency_ms,
    tokens_per_second: ev.tokens_per_second,
    questions_evaluated: ev.questions_evaluated,
    questions_correct: ev.questions_correct,
    failure_rate: ev.failure_rate,
    models: {
      id: ev.models.id,
      name: ev.models.name,
      vendor: ev.models.vendor,
      category: ev.models.category,
      pricing_input: ev.models.pricing_input,
    },
    benchmarks: { id: ev.benchmarks.id, name: ev.benchmarks.name, category: ev.benchmarks.category },
  };
}

/**
 * Static (Cache Components): the only read is the shared cached completed-evaluations list, so
 * this page prerenders and is revalidated by the "evaluations" tag / cacheLife profile.
 * URL state (?benchmark, ?mode, weights, ?q) is read client-side via useSearchParams.
 */
export default async function LeaderboardPage() {
  const evaluations = await getCompletedEvaluations();
  const rows = evaluations.map(toEvalRow).filter((r): r is EvalRow => r !== null);

  return <LeaderboardClient evaluations={rows} />;
}
