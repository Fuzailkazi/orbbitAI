"use client";

import { RouteError } from "@/components/layout/route-error";

export default function EvaluationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Couldn't load this evaluation"
      backHref="/dashboard/evaluations"
      backLabel="Back to evaluations"
    />
  );
}
