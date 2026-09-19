"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

export function ModelFavoriteButton({ modelId }: { modelId: string }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const active = isFavorite(modelId);

  return (
    <button
      onClick={() => toggleFavorite(modelId)}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-amber-300 bg-amber-50 text-amber-800 shadow-xs"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Star className={`h-3.5 w-3.5 ${active ? "fill-amber-400 text-amber-500" : "text-slate-400"}`} />
      {active ? "In Watchlist" : "Add to Watchlist"}
    </button>
  );
}
