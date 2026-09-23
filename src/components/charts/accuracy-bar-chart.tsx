"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { CHART_THEME } from "@/lib/vendor-colors";

export interface AccuracyBarDatum {
  name: string;
  /** 0–100 percentage. */
  accuracy: number;
  /** Wilson 95% bounds (0–100); null when unavailable. */
  ci_lower: number | null;
  ci_upper: number | null;
}

interface AccuracyBarChartProps {
  data: AccuracyBarDatum[];
  height?: number;
}

type ChartRow = AccuracyBarDatum & {
  /** Relative [minus, plus] error for Recharts' ErrorBar. */
  ci_error: [number, number];
};

const MAX_LABEL_CHARS = 18;

function truncateLabel(label: string): string {
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

function AccuracyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-semibold text-foreground">{d.name}</p>
      <AccuracyWithCI
        accuracy={d.accuracy}
        lower={d.ci_lower}
        upper={d.ci_upper}
        variant="stacked"
        className="mt-1.5"
        valueClassName="text-brand"
      />
    </div>
  );
}

/** Horizontal accuracy bars with Wilson 95% CI whiskers (CLAUDE.md rule 1). */
export function AccuracyBarChart({ data, height = 280 }: AccuracyBarChartProps) {
  const rows: ChartRow[] = data.map((d) => ({
    ...d,
    ci_error:
      d.ci_lower !== null && d.ci_upper !== null
        ? [Math.max(0, d.accuracy - d.ci_lower), Math.max(0, d.ci_upper - d.accuracy)]
        : [0, 0],
  }));
  const longest = Math.max(0, ...rows.map((r) => truncateLabel(r.name).length));
  const labelWidth = Math.min(140, Math.max(64, longest * 7 + 8));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: CHART_THEME.axis, fontFamily: CHART_THEME.fontFamily }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tickFormatter={truncateLabel}
          tick={{ fontSize: 12, fill: CHART_THEME.foreground }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<AccuracyTooltip />} cursor={{ fill: CHART_THEME.cursor }} />
        <Bar dataKey="accuracy" fill={CHART_THEME.brand} radius={[0, 4, 4, 0]} barSize={18}>
          <ErrorBar dataKey="ci_error" direction="x" width={6} strokeWidth={1.5} stroke={CHART_THEME.foreground} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
