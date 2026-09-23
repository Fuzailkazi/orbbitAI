"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

export function ModelFavoriteButton({ modelId }: { modelId: string }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const active = isFavorite(modelId);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(modelId)}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-sm transition-colors",
        active
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      <Star className={cn("h-3.5 w-3.5", active ? "fill-warning text-warning" : "text-muted-foreground")} />
      {active ? "In Watchlist" : "Add to Watchlist"}
    </button>
  );
}
