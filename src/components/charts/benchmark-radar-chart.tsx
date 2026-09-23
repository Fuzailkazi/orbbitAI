"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_THEME, getSeriesColor } from "@/lib/vendor-colors";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";

export interface BenchmarkRadarDatum {
  benchmark: string;
  modelA: number;
  modelB: number;
  /** Optional Wilson 95% bounds, shown in the tooltip (rule 1). */
  modelALower?: number | null;
  modelAUpper?: number | null;
  modelBLower?: number | null;
  modelBUpper?: number | null;
}

interface BenchmarkRadarChartProps {
  data: BenchmarkRadarDatum[];
  nameA: string;
  nameB: string;
  /** Series colors (CSS color strings, e.g. from getVendorColor). */
  colorA?: string;
  colorB?: string;
  height?: number;
}

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: BenchmarkRadarDatum;
}

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 font-mono text-popover-foreground shadow-sm">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {payload.map((p) => {
        const d = p.payload;
        const isA = p.dataKey === "modelA";
        const lower = isA ? d?.modelALower : d?.modelBLower;
        const upper = isA ? d?.modelAUpper : d?.modelBUpper;
        const value = typeof p.value === "number" ? p.value : Number(p.value);
        return (
          <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="max-w-40 truncate">{p.name}</span>
            <AccuracyWithCI accuracy={value} lower={lower} upper={upper} ciFormat="range" size="xs" />
          </p>
        );
      })}
    </div>
  );
}

export function BenchmarkRadarChart({
  data,
  nameA,
  nameB,
  colorA = getSeriesColor(0),
  colorB = getSeriesColor(2),
  height = 320,
}: BenchmarkRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke={CHART_THEME.grid} />
        <PolarAngleAxis
          dataKey="benchmark"
          tick={{ fontSize: 10, fill: CHART_THEME.axis, fontFamily: CHART_THEME.fontFamily }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} tickCount={5} axisLine={false} />
        <Tooltip content={<RadarTooltip />} />
        <Legend
          content={() => (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 font-mono text-[11px] text-muted-foreground">
              {[
                { name: nameA, color: colorA },
                { name: nameB, color: colorB },
              ].map((s) => (
                <span key={s.name} className="inline-flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </span>
              ))}
            </div>
          )}
        />
        <Radar name={nameA} dataKey="modelA" stroke={colorA} fill={colorA} fillOpacity={0.12} strokeWidth={2} />
        <Radar name={nameB} dataKey="modelB" stroke={colorB} fill={colorB} fillOpacity={0.14} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
