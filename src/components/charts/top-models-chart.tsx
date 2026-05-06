"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface TopModelsChartProps {
  data: Array<{
    name: string;
    score: number;
    vendor: string;
  }>;
  label?: string;
  height?: number;
}

const VENDOR_COLORS: Record<string, string> = {
  OpenAI: "#10b981",
  Anthropic: "#6366f1",
  Google: "#f59e0b",
  Meta: "#3b82f6",
  DeepSeek: "#8b5cf6",
  "xAI": "#ef4444",
  Mistral: "#f97316",
  Qwen: "#14b8a6",
  Cohere: "#ec4899",
  Microsoft: "#06b6d4",
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopModelsChartProps["data"][0] }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">{d.name}</p>
      <p className="text-[10px] text-slate-400">{d.vendor}</p>
      <p className="mt-1 font-mono text-sm text-indigo-600">{d.score.toFixed(1)}</p>
    </div>
  );
}

export function TopModelsChart({ data, label = "Score", height = 260 }: TopModelsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          label={{ value: label, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={VENDOR_COLORS[d.vendor] ?? "#6366f1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
