"use client";

import { RouteError } from "@/components/layout/route-error";

export default function RootError({
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
      layout="page"
      title="Orbbit hit an unexpected error"
      backHref="/"
      backLabel="Back to home"
    />
  );
}
