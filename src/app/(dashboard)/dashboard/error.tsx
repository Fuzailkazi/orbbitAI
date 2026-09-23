"use client";

import { RouteError } from "@/components/layout/route-error";

export default function DashboardError({
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
      title="Couldn't load the overview"
      backHref="/"
      backLabel="Back to home"
    />
  );
}
