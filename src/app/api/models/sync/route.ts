import { NextResponse, type NextRequest } from "next/server";
import { syncOpenRouterModels } from "@/lib/openrouter/sync";
import { AdminConfigError } from "@/lib/supabase/admin";
import { requireApiSession } from "@/lib/api/auth";
import { apiError, errorMessage } from "@/lib/api/responses";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { revalidateModels } from "@/lib/data/revalidate";

export const maxDuration = 60;

// One sync at a time per server instance — concurrent clicks would race the same upserts.
let syncInFlight = false;

/** POST /api/models/sync — pulls the OpenRouter catalog into the models table. */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  // Per-IP, per-instance sliding window (see lib/api/rate-limit.ts).
  const limited = enforceRateLimit(req, "modelSync");
  if (limited) return limited;

  if (syncInFlight) {
    return apiError("A model sync is already running. Try again shortly.", "SYNC_IN_PROGRESS", 409);
  }

  syncInFlight = true;
  try {
    const result = await syncOpenRouterModels();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("Model sync error:", err);
    if (err instanceof AdminConfigError) {
      return apiError(err.message, "CONFIG_ERROR", 500);
    }
    return apiError(errorMessage(err, "Model sync failed."), "UPSTREAM_ERROR", 502);
  } finally {
    syncInFlight = false;
    // Catalog, picker and evaluation joins (model names) are cached under the models tag. Also
    // after a failure: the sync may have upserted some rows before it threw.
    revalidateModels();
  }
}
