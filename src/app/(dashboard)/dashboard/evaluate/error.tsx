"use client";

import { RouteError } from "@/components/layout/route-error";

export default function EvaluateError({
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
      title="Couldn't load the evaluation runner"
      backHref="/dashboard"
      backLabel="Back to overview"
    />
  );
}
