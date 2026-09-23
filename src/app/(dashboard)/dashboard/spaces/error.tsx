"use client";

import { RouteError } from "@/components/layout/route-error";

export default function SpacesError({
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
      title="Couldn't load spaces"
      backHref="/dashboard"
      backLabel="Back to overview"
    />
  );
}
