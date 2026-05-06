"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface AccuracyBarChartProps {
  data: Array<{
    name: string;
    accuracy: number;
    ci_lower: number;
    ci_upper: number;
  }>;
  height?: number;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#818cf8",
  "#7c3aed", "#6d28d9", "#5b21b6", "#4f46e5",
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AccuracyBarChartProps["data"][0] }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">{d.name}</p>
      <p className="mt-1 font-mono text-sm text-indigo-600">{d.accuracy.toFixed(1)}%</p>
      <p className="font-mono text-[10px] text-slate-400">
        CI: {d.ci_lower.toFixed(1)}–{d.ci_upper.toFixed(1)}%
      </p>
    </div>
  );
}

export function AccuracyBarChart({ data, height = 280 }: AccuracyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "#475569" }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
