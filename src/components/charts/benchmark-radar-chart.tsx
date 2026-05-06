"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";

interface BenchmarkRadarChartProps {
  data: Array<{
    benchmark: string;
    modelA: number;
    modelB: number;
  }>;
  nameA: string;
  nameB: string;
  height?: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 font-mono text-xs" style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export function BenchmarkRadarChart({ data, nameA, nameB, height = 320 }: BenchmarkRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="benchmark" tick={{ fontSize: 11, fill: "#64748b" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={5} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Radar name={nameA} dataKey="modelA" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
        <Radar name={nameB} dataKey="modelB" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
