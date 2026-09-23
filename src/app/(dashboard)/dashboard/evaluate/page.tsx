import type { Metadata } from "next";
import { getFreeModels, getModelById, getRunnableBenchmarks } from "@/lib/data";
import { isUuid } from "@/lib/api/responses";
import {
  EvaluateClient,
  type EvaluateBenchmark,
  type EvaluateModel,
} from "./evaluate-client";

export const metadata: Metadata = {
  title: "Run evaluation",
};

export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string | string[] }>;
}) {
  // searchParams is request-time data; loading.tsx is its Suspense boundary. The model and
  // benchmark lists come from the shared cache (src/lib/data), so no per-request query runs.
  const [params, freeModels, runnable] = await Promise.all([
    searchParams,
    getFreeModels(),
    getRunnableBenchmarks(),
  ]);
  const requestedModelId = isUuid(params.model) ? params.model : undefined;

  // Live runs are restricted to OpenRouter's free tier (CLAUDE.md), so only `:free` models are
  // sent to the client — this also keeps the payload small.
  const models: EvaluateModel[] = freeModels;

  // Runnable prompts, matching the runner: standard benchmarks run imported (hf) questions only
  // (0 = "not yet runnable"); custom uploads run all of theirs.
  const benchmarks: EvaluateBenchmark[] = runnable.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    category: b.category,
    scoring_method: b.scoring_method,
    total_questions: b.total_questions,
    source_url: b.source_url ?? null,
    available_questions: b.available_questions,
  }));

  // Deep link from a model detail page (?model=<id>). Paid models cannot run live,
  // so resolve their name to explain why a free model is selected instead. The name is only a
  // hint, so a lookup failure is logged and the page still renders (as before).
  const requestedPaidModelName =
    requestedModelId && !models.some((m) => m.id === requestedModelId)
      ? (
          await getModelById(requestedModelId).catch((err: unknown) => {
            console.error("Failed to resolve the requested model name:", err);
            return null;
          })
        )?.name
      : undefined;

  return (
    <EvaluateClient
      models={models}
      benchmarks={benchmarks}
      initialModelId={requestedModelId}
      requestedPaidModelName={requestedPaidModelName}
    />
  );
}
