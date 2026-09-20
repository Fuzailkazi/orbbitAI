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
    <div className="rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 shadow-2xs font-mono">
      <p className="text-xs font-semibold text-zinc-950">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value.toFixed(1)}%</span>
        </p>
      ))}
    </div>
  );
}

export function BenchmarkRadarChart({ data, nameA, nameB, height = 320 }: BenchmarkRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="rgba(0,0,0,0.07)" />
        <PolarAngleAxis dataKey="benchmark" tick={{ fontSize: 10, fill: "#71717a", fontFamily: "var(--font-mono)" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#a1a1aa", fontFamily: "var(--font-mono)" }} tickCount={5} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 10, fontFamily: "var(--font-mono)" }}
          iconType="circle"
          iconSize={8}
        />
        <Radar name={nameA} dataKey="modelA" stroke="#18181B" fill="#18181B" fillOpacity={0.12} strokeWidth={2} />
        <Radar name={nameB} dataKey="modelB" stroke="#EA580C" fill="#EA580C" fillOpacity={0.15} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
