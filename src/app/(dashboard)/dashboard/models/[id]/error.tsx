"use client";

import { RouteError } from "@/components/layout/route-error";

export default function ModelDetailError({
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
      title="Couldn't load this model"
      backHref="/dashboard/models"
      backLabel="Back to models"
    />
  );
}
