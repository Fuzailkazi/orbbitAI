import { spaces as curatedSpaces } from "../../../supabase/seed-spaces";

/**
 * Canonical form used for every protected-name comparison (POST and DELETE alike):
 * Unicode-normalized, trimmed, internal whitespace collapsed, case-folded. So
 * "mathematics", " MATHEMATICS " and "Mathematics" all collide with the curated space.
 */
export function normalizeSpaceName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Curated spaces shipped with the seed data. They can't be created, shadowed or deleted via the API. */
const PROTECTED_SPACE_NAMES = new Set(curatedSpaces.map((s) => normalizeSpaceName(s.name)));

export function isProtectedSpaceName(name: string): boolean {
  return PROTECTED_SPACE_NAMES.has(normalizeSpaceName(name));
}
