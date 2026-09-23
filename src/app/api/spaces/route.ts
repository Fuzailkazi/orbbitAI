import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, AdminConfigError } from "@/lib/supabase/admin";
import { requireApiSession } from "@/lib/api/auth";
import {
  apiError,
  databaseErrorResponse,
  errorMessage,
  isUuid,
  readJsonObject,
} from "@/lib/api/responses";
import { isProtectedSpaceName } from "@/lib/spaces/protected";
import { revalidateSpaces } from "@/lib/data/revalidate";

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_BENCHMARKS = 50;
const ICON_RE = /^[a-z0-9-]{1,40}$/;

function internalError(err: unknown, fallback: string) {
  if (err instanceof AdminConfigError) return apiError(err.message, "CONFIG_ERROR", 500);
  return apiError(errorMessage(err, fallback), "INTERNAL_ERROR", 500);
}

/** POST /api/spaces — { name, description?, icon?, benchmarkIds: string[] } */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const { name, description, icon, benchmarkIds } = parsed.body;

  if (typeof name !== "string" || !name.trim()) {
    return apiError("Space name is required.", "VALIDATION_ERROR", 400);
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return apiError(`Space name must be ${MAX_NAME_LENGTH} characters or fewer.`, "VALIDATION_ERROR", 400);
  }
  // Same case-insensitive check DELETE uses: a user space named "mathematics" would shadow the
  // curated "Mathematics" and then be undeletable, so it is rejected up front.
  if (isProtectedSpaceName(name)) {
    return apiError(
      `"${name.trim()}" is reserved for a curated space. Choose a different name.`,
      "PROTECTED_RESOURCE",
      409
    );
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    return apiError("Description must be a string.", "VALIDATION_ERROR", 400);
  }
  const cleanDescription = (description ?? "").trim();
  if (cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    return apiError(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
      "VALIDATION_ERROR",
      400
    );
  }
  if (icon !== undefined && icon !== null && (typeof icon !== "string" || !ICON_RE.test(icon))) {
    return apiError("Icon must be a lucide icon slug (e.g. \"layout-grid\").", "VALIDATION_ERROR", 400);
  }
  if (!Array.isArray(benchmarkIds) || benchmarkIds.length === 0) {
    return apiError("Please select at least one benchmark.", "VALIDATION_ERROR", 400);
  }
  if (!benchmarkIds.every(isUuid)) {
    return apiError("benchmarkIds must be an array of benchmark UUIDs.", "VALIDATION_ERROR", 400);
  }
  const uniqueBenchmarkIds = Array.from(new Set(benchmarkIds));
  if (uniqueBenchmarkIds.length > MAX_BENCHMARKS) {
    return apiError(`A space can include at most ${MAX_BENCHMARKS} benchmarks.`, "VALIDATION_ERROR", 400);
  }

  try {
    const supabase = createAdminClient();

    // Every referenced benchmark must exist.
    const { data: found, error: lookupError } = await supabase
      .from("benchmarks")
      .select("id")
      .in("id", uniqueBenchmarkIds);
    if (lookupError) return databaseErrorResponse(lookupError, "Failed to validate benchmarks");
    if ((found ?? []).length !== uniqueBenchmarkIds.length) {
      return apiError("One or more selected benchmarks no longer exist.", "VALIDATION_ERROR", 400);
    }

    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .insert({
        name: name.trim(),
        description: cleanDescription,
        icon: typeof icon === "string" ? icon : "layout-grid",
        benchmark_ids: uniqueBenchmarkIds,
      })
      .select()
      .single();

    if (spaceError || !space) {
      return spaceError
        ? databaseErrorResponse(spaceError, "Failed to create space")
        : apiError("Failed to create space.", "DATABASE_ERROR", 500);
    }

    const spaceId = (space as { id: string }).id;
    const { error: junctionError } = await supabase
      .from("space_benchmarks")
      .insert(uniqueBenchmarkIds.map((benchmarkId) => ({ space_id: spaceId, benchmark_id: benchmarkId })));

    if (junctionError) {
      // Roll back so we never leave a space without its benchmark links.
      await supabase.from("spaces").delete().eq("id", spaceId);
      return databaseErrorResponse(junctionError, "Failed to link benchmarks to space");
    }

    revalidateSpaces();
    return NextResponse.json({ success: true, data: space }, { status: 201 });
  } catch (err) {
    console.error("Space creation error:", err);
    return internalError(err, "Failed to create space.");
  }
}

/** DELETE /api/spaces?id=<uuid> */
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return apiError("Space ID is required.", "VALIDATION_ERROR", 400);
  }
  if (!isUuid(id)) {
    return apiError("Space ID must be a UUID.", "VALIDATION_ERROR", 400);
  }

  try {
    const supabase = createAdminClient();

    const { data: existing, error: lookupError } = await supabase
      .from("spaces")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) return databaseErrorResponse(lookupError, "Failed to load space");
    if (!existing) return apiError("Space not found.", "NOT_FOUND", 404);

    const spaceName = (existing as { name: string }).name;
    if (isProtectedSpaceName(spaceName)) {
      return apiError(
        `"${spaceName}" is a curated space and can't be deleted.`,
        "PROTECTED_RESOURCE",
        403
      );
    }

    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) return databaseErrorResponse(error, "Failed to delete space");

    revalidateSpaces();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Space deletion error:", err);
    return internalError(err, "Failed to delete space.");
  }
}
