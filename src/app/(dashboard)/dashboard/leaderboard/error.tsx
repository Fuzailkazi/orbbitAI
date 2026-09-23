"use client";

import { RouteError } from "@/components/layout/route-error";

export default function LeaderboardError({
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
      title="Couldn't load the leaderboard"
      backHref="/dashboard"
      backLabel="Back to overview"
    />
  );
}
