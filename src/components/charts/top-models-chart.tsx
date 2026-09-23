"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import { BarChart3, AlignLeft } from "lucide-react";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { Skeleton } from "@/components/ui/skeleton";
import { formatModelName, formatNumber, formatVendor } from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";
import type { ChartRow } from "./top-models-bar-chart";

// Recharts is only needed for the "Bars" view, so it lives in its own chunk: the default
// "Ranked" view ships without it. Preloaded on hover/focus of the toggle so the switch is instant.
const loadBarChart = () => import("./top-models-bar-chart");
const TopModelsBarChart = lazy(() => loadBarChart().then((m) => ({ default: m.TopModelsBarChart })));
function preloadBarChart() {
  void loadBarChart();
}

export interface TopModelsChartDatum {
  name: string;
  /** Accuracy (0–100) or any other score, depending on `metric`. */
  score: number;
  vendor: string;
  /** Wilson 95% CI bounds (0–100). Shown whenever the metric is accuracy. */
  ciLower?: number | null;
  ciUpper?: number | null;
  /** Benchmark the score comes from — disambiguates ties across suites. */
  benchmark?: string | null;
  /** Sample size (questions evaluated) behind the score. */
  n?: number | null;
  /** Optional drill-down link (e.g. the evaluation detail page). */
  href?: string;
}

export interface TopModelsChartProps {
  data: TopModelsChartDatum[];
  label?: string;
  height?: number;
  /**
   * `accuracy` renders the value with its Wilson CI (CLAUDE.md rule 1).
   * Defaults to `accuracy` when the label mentions "%" or "accuracy", otherwise `score`.
   */
  metric?: "accuracy" | "score";
}

function hasCI(d: TopModelsChartDatum): d is TopModelsChartDatum & { ciLower: number; ciUpper: number } {
  return typeof d.ciLower === "number" && typeof d.ciUpper === "number";
}

export function describeSource(d: TopModelsChartDatum): string | null {
  const parts: string[] = [];
  if (d.benchmark) parts.push(d.benchmark);
  if (typeof d.n === "number" && d.n > 0) parts.push(`n=${formatNumber(d.n)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ScoreValue({ d, isAccuracy, unit, size = "xs" }: { d: TopModelsChartDatum; isAccuracy: boolean; unit: string; size?: "xs" | "sm" }) {
  if (isAccuracy) {
    return (
      <AccuracyWithCI
        accuracy={d.score}
        lower={d.ciLower ?? null}
        upper={d.ciUpper ?? null}
        size={size}
        valueClassName="font-semibold"
      />
    );
  }
  return (
    <span className="font-mono tabular-nums">
      <span className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-xs")}>{d.score.toFixed(1)}</span>
      <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
    </span>
  );
}

export function TopModelsChart({ data, label = "Score", height = 320, metric }: TopModelsChartProps) {
  const [layoutMode, setLayoutMode] = useState<"horizontal" | "vertical">("horizontal");

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
        No evaluation data available to chart
      </div>
    );
  }

  const isAccuracy = (metric ?? (/%|accuracy/i.test(label) ? "accuracy" : "score")) === "accuracy";
  const unit = label.includes("%") ? "%" : "pts";
  const maxScore = Math.max(...data.map((d) => d.score), 100);

  const ranked = data.slice(0, 10);
  const columns: ChartRow[] = data.slice(0, 12).map((d) => ({
    ...d,
    ciError: isAccuracy && hasCI(d) ? [Math.max(0, d.score - d.ciLower), Math.max(0, d.ciUpper - d.score)] : undefined,
  }));

  // Legend reflects the vendors actually on screen, in rank order.
  const legendVendors = [...new Set(ranked.map((d) => formatVendor(d.vendor)))].slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Sub-header: vendor legend + layout switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {legendVendors.map((vendor) => (
            <span
              key={vendor}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getVendorColor(vendor) }} />
              {vendor}
            </span>
          ))}
        </div>

        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Chart layout">
          {([
            { mode: "horizontal", label: "Ranked", icon: AlignLeft },
            { mode: "vertical", label: "Bars", icon: BarChart3 },
          ] as const).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setLayoutMode(opt.mode)}
              onPointerEnter={opt.mode === "vertical" ? preloadBarChart : undefined}
              onFocus={opt.mode === "vertical" ? preloadBarChart : undefined}
              aria-pressed={layoutMode === opt.mode}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                layoutMode === opt.mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {layoutMode === "horizontal" ? (
        <ol className="space-y-2 pt-1">
          {ranked.map((d, index) => {
            const color = getVendorColor(d.vendor);
            const percentage = Math.min(100, Math.max(0, (d.score / maxScore) * 100));
            const source = describeSource(d);
            const rowClass =
              "group relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors sm:grid-cols-[1.5rem_minmax(0,16rem)_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-4";
            const content = (
              <>
                <span className="font-mono text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground" title={d.name}>
                      {formatModelName(d.name)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatVendor(d.vendor)}
                      {source ? <span className="font-mono"> · {source}</span> : null}
                    </p>
                  </div>
                </div>

                {/* Proportional bar: full row on mobile, middle column from sm */}
                <div className="col-span-3 col-start-1 row-start-2 flex h-4 items-center sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    {/* Grows in from the left: the bar slides in by its own width and the track clips
                        it, so its right edge follows the same curve as a 0 -> width tween (CSS only). */}
                    <div
                      className="h-full rounded-full animate-in fill-mode-both slide-in-from-left-full duration-500 ease-[cubic-bezier(0,0,0.58,1)]"
                      style={{ width: `${percentage}%`, backgroundColor: color, animationDelay: `${index * 20}ms` }}
                    />
                  </div>
                </div>

                <div className="col-start-3 row-start-1 flex justify-end text-right sm:col-start-4 sm:min-w-28">
                  <ScoreValue d={d} isAccuracy={isAccuracy} unit={unit} />
                </div>
              </>
            );

            return (
              <li
                key={`${d.name}-${index}`}
                className="animate-in fill-mode-both fade-in slide-in-from-left-[6px] duration-250 ease-[cubic-bezier(0.42,0,0.58,1)]"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                {d.href ? (
                  <Link href={d.href} className={cn(rowClass, "hover:border-foreground/20 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}>
                    {content}
                  </Link>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height }} />}>
          <TopModelsBarChart
            columns={columns}
            label={label}
            height={height}
            maxScore={maxScore}
            isAccuracy={isAccuracy}
            unit={unit}
          />
        </Suspense>
      )}
    </div>
  );
}
