import type { Metadata } from "next";
import { getBenchmarks, getCompletedEvaluations, getSpacesWithBenchmarks } from "@/lib/data";
import { resolveCI, scoredQuestionCount } from "@/lib/format";
import { isProtectedSpaceName } from "@/lib/spaces/protected";
import type { Evaluation, Model } from "@/types/database";
import { SpacesClient, type SpaceBenchmarkOption, type SpaceStat } from "./spaces-client";

export const metadata: Metadata = {
  title: "Spaces",
};

type SpaceEvaluationRow = Pick<
  Evaluation,
  | "benchmark_id"
  | "accuracy"
  | "accuracy_ci_lower"
  | "accuracy_ci_upper"
  | "questions_evaluated"
  | "questions_correct"
  | "failure_rate"
> & {
  models: Pick<Model, "id" | "name" | "vendor"> | null;
};

interface Tally {
  correct: number;
  total: number;
  accuracySum: number;
  accuracyCount: number;
}

function emptyTally(): Tally {
  return { correct: 0, total: 0, accuracySum: 0, accuracyCount: 0 };
}

/** Adds one evaluation's question counts (backing out `correct` from accuracy when missing). */
function addToTally(t: Tally, ev: SpaceEvaluationRow) {
  if (typeof ev.accuracy === "number") {
    t.accuracySum += ev.accuracy;
    t.accuracyCount += 1;
  }
  // Scored prompts only: failed calls / unscored prompts are not in the accuracy denominator.
  const n = scoredQuestionCount(ev);
  if (n <= 0) return;
  const k =
    typeof ev.questions_correct === "number"
      ? ev.questions_correct
      : typeof ev.accuracy === "number"
        ? Math.round((ev.accuracy / 100) * n)
        : null;
  if (k === null) return;
  t.correct += k;
  t.total += n;
}

/** Pooled accuracy with a Wilson 95% CI over all summed questions (rule 1). */
function pooledCI(t: Tally) {
  if (t.total > 0) {
    const ci = resolveCI({
      accuracy: (t.correct / t.total) * 100,
      questions_evaluated: t.total,
      questions_correct: t.correct,
    });
    return { accuracy: ci.accuracy, lower: ci.lower, upper: ci.upper, questions: t.total };
  }
  // No question counts at all: show the plain mean and let the UI mark the CI as unavailable.
  return {
    accuracy: t.accuracyCount > 0 ? t.accuracySum / t.accuracyCount : null,
    lower: null,
    upper: null,
    questions: 0,
  };
}

export default async function SpacesPage() {
  // Cached, public reads (RLS applies via the anon client): spaces + benchmarks use the catalog
  // profile, completed evaluations the short-lived evaluations profile. Invalidated by tag on writes.
  const [spacesWithBenchmarks, benchmarkRows, completed] = await Promise.all([
    getSpacesWithBenchmarks(),
    getBenchmarks(),
    getCompletedEvaluations(),
  ]);

  // Trim to what the page renders so the RSC payload stays small.
  const benchmarks: SpaceBenchmarkOption[] = benchmarkRows.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
  }));
  const evaluations: SpaceEvaluationRow[] = completed.map((ev) => ({
    benchmark_id: ev.benchmark_id,
    accuracy: ev.accuracy,
    accuracy_ci_lower: ev.accuracy_ci_lower,
    accuracy_ci_upper: ev.accuracy_ci_upper,
    questions_evaluated: ev.questions_evaluated,
    questions_correct: ev.questions_correct,
    failure_rate: ev.failure_rate,
    models: ev.models ? { id: ev.models.id, name: ev.models.name, vendor: ev.models.vendor } : null,
  }));

  const spaceStats: SpaceStat[] = spacesWithBenchmarks.map(({ benchmarks: spaceBenchmarks, ...space }) => {
    const ids = new Set(space.benchmark_ids);
    const evals = evaluations.filter((e) => ids.has(e.benchmark_id));

    const overall = emptyTally();
    const perModel = new Map<string, { model: NonNullable<SpaceEvaluationRow["models"]>; tally: Tally }>();
    for (const ev of evals) {
      addToTally(overall, ev);
      if (!ev.models) continue;
      const entry = perModel.get(ev.models.id) ?? { model: ev.models, tally: emptyTally() };
      addToTally(entry.tally, ev);
      perModel.set(ev.models.id, entry);
    }

    // Rank models by the Wilson lower bound so a tiny sample can't top a large one.
    let top: SpaceStat["top"] = null;
    for (const { model, tally } of perModel.values()) {
      const ci = pooledCI(tally);
      if (ci.accuracy === null) continue;
      const rankKey = ci.lower ?? -1;
      const topKey = top ? (top.lower ?? -1) : -Infinity;
      if (!top || rankKey > topKey || (rankKey === topKey && ci.accuracy > (top.accuracy ?? -1))) {
        top = { id: model.id, name: model.name, vendor: model.vendor, ...ci };
      }
    }

    return {
      space,
      benchmarks: spaceBenchmarks,
      evaluationCount: evals.length,
      modelCount: perModel.size,
      pooled: pooledCI(overall),
      top,
      isCurated: isProtectedSpaceName(space.name),
    };
  });

  return <SpacesClient benchmarks={benchmarks} spaceStats={spaceStats} />;
}
