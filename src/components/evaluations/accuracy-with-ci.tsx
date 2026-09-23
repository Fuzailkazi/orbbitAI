import { cn } from "@/lib/utils";
import { formatCI, formatCIMargin, formatPct } from "@/lib/format";

type AccuracyWithCISize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AccuracyWithCIProps {
  /** 0–100 percentage. `null` renders an em dash. */
  accuracy: number | null | undefined;
  /** Wilson 95% lower bound (0–100). */
  lower: number | null | undefined;
  /** Wilson 95% upper bound (0–100). */
  upper: number | null | undefined;
  /**
   * - `inline`: "97.8% ±0.9" (or "[96.1–98.8]" with `ciFormat="range"`) on one line.
   * - `stacked`: big number with a small "95% CI 96.1–98.8" line underneath.
   */
  variant?: "inline" | "stacked";
  /** How the inline CI is written. Defaults to `margin` (±x.x). Stacked always shows the range. */
  ciFormat?: "margin" | "range";
  size?: AccuracyWithCISize;
  digits?: number;
  /** Alignment for the stacked variant. */
  align?: "start" | "end" | "center";
  className?: string;
  /** Extra classes for the headline number (e.g. a color token). */
  valueClassName?: string;
}

const VALUE_SIZE: Record<AccuracyWithCISize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl tracking-tight",
  xl: "text-3xl tracking-tight",
};

const CI_SIZE: Record<AccuracyWithCISize, string> = {
  xs: "text-[10px]",
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-xs",
  xl: "text-xs",
};

const ALIGN: Record<NonNullable<AccuracyWithCIProps["align"]>, string> = {
  start: "items-start text-left",
  end: "items-end text-right",
  center: "items-center text-center",
};

function hasBounds(
  lower: number | null | undefined,
  upper: number | null | undefined
): lower is number {
  return (
    typeof lower === "number" &&
    typeof upper === "number" &&
    Number.isFinite(lower) &&
    Number.isFinite(upper)
  );
}

/**
 * Accuracy with its Wilson 95% confidence interval (CLAUDE.md rule 1).
 * Server-compatible (no client hooks). When bounds are missing it shows a muted "CI n/a"
 * instead of hiding the interval.
 */
export function AccuracyWithCI({
  accuracy,
  lower,
  upper,
  variant = "inline",
  ciFormat = "margin",
  size = "sm",
  digits = 1,
  align = "start",
  className,
  valueClassName,
}: AccuracyWithCIProps) {
  const known = typeof accuracy === "number" && Number.isFinite(accuracy);
  const bounds = hasBounds(lower, upper);
  const rangeText = bounds ? formatCI(lower, upper, digits) : null;
  const title = known
    ? bounds
      ? `Accuracy ${formatPct(accuracy, digits)} (Wilson 95% CI ${rangeText})`
      : `Accuracy ${formatPct(accuracy, digits)} (confidence interval unavailable)`
    : "No accuracy recorded";

  if (variant === "stacked") {
    return (
      <span className={cn("inline-flex flex-col gap-0.5", ALIGN[align], className)} title={title}>
        <span
          data-metric
          className={cn(
            "font-mono font-semibold leading-none text-foreground tabular-nums",
            VALUE_SIZE[size],
            valueClassName
          )}
        >
          {formatPct(accuracy, digits)}
        </span>
        {known && (
          <span className={cn("font-mono leading-tight text-muted-foreground tabular-nums", CI_SIZE[size])}>
            {bounds ? `95% CI ${rangeText}` : "CI n/a"}
          </span>
        )}
      </span>
    );
  }

  const ciText = bounds
    ? ciFormat === "range"
      ? `[${rangeText}]`
      : formatCIMargin(lower, upper, digits)
    : "CI n/a";

  return (
    <span
      className={cn("inline-flex items-baseline gap-1 whitespace-nowrap", className)}
      title={title}
    >
      <span
        data-metric
        className={cn(
          "font-mono font-semibold text-foreground tabular-nums",
          VALUE_SIZE[size],
          valueClassName
        )}
      >
        {formatPct(accuracy, digits)}
      </span>
      {known && (
        <span className={cn("font-mono font-normal text-muted-foreground tabular-nums", CI_SIZE[size])}>
          {ciText}
        </span>
      )}
    </span>
  );
}
