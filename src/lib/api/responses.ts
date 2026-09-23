import { NextResponse } from "next/server";

/**
 * Typed API error envelope used by every route handler (see CLAUDE.md → Error Handling).
 */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
}

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "MODEL_NOT_FREE"
  | "SELF_JUDGED"
  | "PROTECTED_RESOURCE"
  | "SYNC_IN_PROGRESS"
  | "CONFIG_ERROR"
  | "DATABASE_ERROR"
  | "UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function apiError(error: string, code: ApiErrorCode, status: number): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>({ error, code }, { status });
}

/** Extracts a human-readable message from an unknown thrown value. */
export function errorMessage(err: unknown, fallback = "Unexpected error"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  if (isRecord(err) && typeof err.message === "string" && err.message.length > 0) {
    return err.message;
  }
  return fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/** Parses a JSON object body. Returns a typed 400 response for malformed or non-object payloads. */
export async function readJsonObject(req: Request): Promise<JsonBodyResult> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return { ok: false, response: apiError("Request body must be valid JSON.", "INVALID_JSON", 400) };
  }
  if (!isRecord(parsed)) {
    return { ok: false, response: apiError("Request body must be a JSON object.", "INVALID_JSON", 400) };
  }
  return { ok: true, body: parsed };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Maps a PostgREST / Postgres error to an HTTP status + code. 23505 = unique violation. */
export function databaseErrorResponse(
  err: { code?: string; message: string },
  context: string
): NextResponse<ApiErrorBody> {
  if (err.code === "23505") {
    return apiError(`${context}: a record with that name already exists.`, "CONFLICT", 409);
  }
  if (err.code === "23503") {
    return apiError(`${context}: referenced record does not exist.`, "VALIDATION_ERROR", 400);
  }
  if (err.code === "22P02") {
    return apiError(`${context}: invalid identifier or enum value.`, "VALIDATION_ERROR", 400);
  }
  return apiError(`${context}: ${err.message}`, "DATABASE_ERROR", 500);
}
