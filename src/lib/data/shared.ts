/** Helpers shared by the cached query modules. Pure — safe to import anywhere on the server. */

/** Thrown when a Supabase query fails; `code` is the PostgREST / Postgres error code when known. */
export class DataQueryError extends Error {
  readonly code: string | null;

  constructor(context: string, error: { message: string; code?: string | null }) {
    super(`${context}: ${error.message}`);
    this.name = "DataQueryError";
    this.code = error.code ?? null;
  }
}

/** Postgres "invalid text representation" — e.g. a malformed UUID in `.eq("id", …)`. */
export const PG_INVALID_TEXT = "22P02";

/** NUMERIC columns can arrive as strings from PostgREST; normalize to number | null. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Same as toNumberOrNull for NOT NULL columns (falls back to 0). */
export function toNumber(value: unknown): number {
  return toNumberOrNull(value) ?? 0;
}

/** Many-to-one embeds are objects, but untyped clients may hand back a one-element array. */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
