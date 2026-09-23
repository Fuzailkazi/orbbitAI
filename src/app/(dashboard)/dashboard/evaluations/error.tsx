"use client";

import { RouteError } from "@/components/layout/route-error";

export default function EvaluationsError({
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
      title="Couldn't load evaluations"
      backHref="/dashboard"
      backLabel="Back to overview"
    />
  );
}
