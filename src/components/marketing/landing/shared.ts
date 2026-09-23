import type { ArenaCategory, ScoreCell } from "./types";

/** Display order of arena category tabs and benchmark rows. */
export const CATEGORY_ORDER: readonly ArenaCategory[] = ["Knowledge", "Code", "Math", "Reasoning", "Chat"];

/** Drill-down link for one recorded evaluation (prompt-level results). */
export function evaluationHref(evaluationId: string): string {
  return `/dashboard/evaluations/${evaluationId}`;
}

export function intervalsOverlap(a: ScoreCell, b: ScoreCell): boolean {
  if (a.lower === null || a.upper === null || b.lower === null || b.upper === null) return false;
  return a.lower <= b.upper && b.lower <= a.upper;
}

/** Shared easing of every landing entrance animation (was motion's [0.16, 1, 0.3, 1]). */
export const EASE_OUT_EXPO = "cubic-bezier(0.16,1,0.3,1)";

export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "#comparison", label: "Benchmark Arena" },
  { href: "#methodology", label: "Scoring Engine" },
  { href: "#features", label: "Capabilities" },
  { href: "/docs", label: "Documentation" },
];
