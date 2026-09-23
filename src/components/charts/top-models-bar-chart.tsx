"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ErrorBar,
} from "recharts";
import { formatModelName, formatVendor } from "@/lib/format";
import { CHART_THEME, getVendorColor } from "@/lib/vendor-colors";
import { describeSource, ScoreValue, type TopModelsChartDatum } from "./top-models-chart";

/**
 * The "Bars" view of TopModelsChart. Lives in its own module so Recharts is only downloaded when
 * a viewer switches to Bars (the default "Ranked" view is plain markup) — TopModelsChart loads it
 * with React.lazy and preloads it on hover/focus of the toggle.
 */

export interface ChartRow extends TopModelsChartDatum {
  /** Asymmetric CI whiskers for Recharts' ErrorBar: [below, above]. */
  ciError?: [number, number];
}

function CustomTooltip({
  active,
  payload,
  isAccuracy,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  isAccuracy: boolean;
  unit: string;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const source = describeSource(d);
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-md">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getVendorColor(d.vendor) }} />
        <p className="text-xs font-semibold text-foreground">{formatModelName(d.name)}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatVendor(d.vendor)}
        {source ? ` · ${source}` : ""}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{isAccuracy ? "Accuracy" : "Score"}</span>
        <ScoreValue d={d} isAccuracy={isAccuracy} unit={unit} size="sm" />
      </div>
    </div>
  );
}

export interface TopModelsBarChartProps {
  columns: ChartRow[];
  label: string;
  height: number;
  maxScore: number;
  isAccuracy: boolean;
  unit: string;
}

export function TopModelsBarChart({ columns, label, height, maxScore, isAccuracy, unit }: TopModelsBarChartProps) {
  const showErrorBars = columns.some((d) => d.ciError);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={columns} margin={{ top: 12, right: 12, left: 8, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} opacity={0.6} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: CHART_THEME.axis }}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
          tickFormatter={(val: string) => formatModelName(val).slice(0, 14)}
          angle={-20}
          textAnchor="end"
          height={50}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_THEME.axis, fontFamily: CHART_THEME.fontFamily }}
          tickLine={false}
          axisLine={false}
          width={36}
          domain={[0, Math.ceil(maxScore / 10) * 10]}
          label={{ value: label, angle: -90, position: "insideLeft", offset: -4, style: { fontSize: 11, fill: CHART_THEME.axis, textAnchor: "middle" } }}
        />
        <Tooltip
          content={<CustomTooltip isAccuracy={isAccuracy} unit={unit} />}
          cursor={{ fill: CHART_THEME.cursor, opacity: 0.3 }}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={26}>
          {columns.map((d, i) => (
            <Cell key={`${d.name}-${i}`} fill={getVendorColor(d.vendor)} className="transition-opacity hover:opacity-85" />
          ))}
          {showErrorBars ? (
            <ErrorBar dataKey="ciError" width={6} strokeWidth={1.25} stroke={CHART_THEME.axis} direction="y" />
          ) : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
