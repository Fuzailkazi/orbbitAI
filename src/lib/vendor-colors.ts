/**
 * Single source of truth for vendor + chart series colors.
 * Hex literals are allowed ONLY in this file; everything else should call these helpers
 * (or use the `var(--chart-N)` / semantic Tailwind tokens from globals.css).
 *
 * All returned values are plain CSS color strings, so they work in `style={{ color }}`,
 * `style={{ backgroundColor }}` and as Recharts `fill` / `stroke` props.
 */
import { formatVendor } from "@/lib/format";

/** Keyed by the human vendor name produced by `formatVendor()`. */
export const VENDOR_COLORS: Readonly<Record<string, string>> = {
  // Near-black brands follow the foreground token so they stay visible in dark mode.
  OpenAI: "var(--foreground)",
  xAI: "#475569",
  Anthropic: "#EA580C",
  Google: "#2563EB",
  "Google DeepMind": "#2563EB",
  DeepSeek: "#6366F1",
  Meta: "#0284C7",
  Alibaba: "#0D9488",
  Qwen: "#0D9488",
  Mistral: "#CA8A04",
  Microsoft: "#059669",
  Cohere: "#E11D48",
  InclusionAI: "#78716C",
  NVIDIA: "#65A30D",
  Amazon: "#D97706",
  "Moonshot AI": "#7C3AED",
  "Z.ai": "#0891B2",
  MiniMax: "#DB2777",
  Perplexity: "#0F766E",
  "Aion Labs": "#9333EA",
};

/** Neutral color used for vendors without an assigned color. */
export const FALLBACK_VENDOR_COLOR = "var(--chart-5)";

/**
 * Color for a vendor slug or name ("anthropic", "Anthropic", "meta-llama", "x-ai" all work).
 * Unknown vendors get `fallback` (defaults to the neutral `var(--chart-5)`).
 */
export function getVendorColor(
  vendor: string | null | undefined,
  fallback: string = FALLBACK_VENDOR_COLOR
): string {
  if (!vendor) return fallback;
  // Accept "vendor/model" identifiers and "Vendor: Model" display names too.
  const raw = vendor.includes("/") ? vendor.split("/")[0] : vendor.split(":")[0];
  return VENDOR_COLORS[formatVendor(raw)] ?? fallback;
}

/**
 * A translucent tint of the vendor color for soft chips / legend backgrounds.
 * `amount` is the percentage of vendor color mixed into transparent (default 12).
 */
export function getVendorTint(vendor: string | null | undefined, amount = 12): string {
  return `color-mix(in oklab, ${getVendorColor(vendor)} ${amount}%, transparent)`;
}

/** Ordered categorical series palette backed by the theme's chart tokens. */
export const SERIES_COLORS: readonly string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Series color by index (wraps around). */
export function getSeriesColor(index: number): string {
  const i = ((index % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length;
  return SERIES_COLORS[i];
}

/** Theme-aware colors for Recharts axes / grid / cursor, so charts need no inline hex. */
export const CHART_THEME = {
  axis: "var(--muted-foreground)",
  grid: "var(--border)",
  cursor: "var(--muted)",
  foreground: "var(--foreground)",
  brand: "var(--brand)",
  fontFamily: "var(--font-mono)",
} as const;
