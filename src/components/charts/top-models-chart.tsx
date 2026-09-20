"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { motion } from "motion/react";
import { BarChart3, AlignLeft } from "lucide-react";

export interface TopModelsChartProps {
  data: Array<{
    name: string;
    score: number;
    vendor: string;
  }>;
  label?: string;
  height?: number;
}

export const VENDOR_PALETTE: Record<
  string,
  { hex: string; bg: string; border: string; text: string; label: string }
> = {
  Anthropic: { hex: "#EA580C", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-950", label: "Anthropic" },
  OpenAI: { hex: "#171717", bg: "bg-neutral-100", border: "border-neutral-300", text: "text-neutral-950", label: "OpenAI" },
  Google: { hex: "#2563EB", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-950", label: "Google" },
  DeepSeek: { hex: "#6366F1", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-950", label: "DeepSeek" },
  Meta: { hex: "#0284C7", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-950", label: "Meta" },
  Alibaba: { hex: "#0D9488", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-950", label: "Alibaba" },
  Qwen: { hex: "#0D9488", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-950", label: "Alibaba" },
  Mistral: { hex: "#F97316", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-950", label: "Mistral" },
  "xAI": { hex: "#475569", bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-900", label: "xAI" },
  Microsoft: { hex: "#059669", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-950", label: "Microsoft" },
  Cohere: { hex: "#E11D48", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-950", label: "Cohere" },
  Inclusionai: { hex: "#78716C", bg: "bg-stone-100", border: "border-stone-200", text: "text-stone-800", label: "InclusionAI" },
};

function getVendorInfo(vendor: string) {
  const norm = Object.keys(VENDOR_PALETTE).find(
    (k) => k.toLowerCase() === vendor.toLowerCase()
  );
  return norm
    ? VENDOR_PALETTE[norm]
    : { hex: "#737373", bg: "bg-muted", border: "border-border", text: "text-foreground", label: vendor };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopModelsChartProps["data"][0] }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const vendorInfo = getVendorInfo(d.vendor);
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: vendorInfo.hex }} />
        <p className="text-xs font-semibold text-foreground">{d.name}</p>
      </div>
      <p className="text-xs text-muted-foreground">{vendorInfo.label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">Score</span>
        <span className="font-mono text-sm font-semibold text-foreground">{d.score.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function TopModelsChart({ data, label = "Score", height = 320 }: TopModelsChartProps) {
  const [layoutMode, setLayoutMode] = useState<"horizontal" | "vertical">("horizontal");

  const maxScore = useMemo(() => {
    return data.length > 0 ? Math.max(...data.map((d) => d.score), 100) : 100;
  }, [data]);

  const formatName = (fullName: string) => {
    return fullName.replace(/^(Anthropic|OpenAI|Google|DeepSeek|Meta|Qwen|Alibaba|Mistral|inclusionAI):\s*/i, "");
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
        No evaluation data available to chart
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-header with Layout Switcher and Vendor Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Vendor Color Legend */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Anthropic", hex: "#EA580C" },
            { label: "OpenAI", hex: "#171717" },
            { label: "Google", hex: "#2563EB" },
            { label: "DeepSeek", hex: "#6366F1" },
            { label: "Alibaba", hex: "#0D9488" },
          ].map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted/40 text-muted-foreground text-xs font-medium"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.hex }} />
              {item.label}
            </span>
          ))}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setLayoutMode("horizontal")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              layoutMode === "horizontal"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlignLeft className="h-3.5 w-3.5" />
            Ranked
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("vertical")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              layoutMode === "vertical"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Bars
          </button>
        </div>
      </div>

      {layoutMode === "horizontal" ? (
        /* Ranked Horizontal Spec List */
        <div className="space-y-2 pt-1">
          {data.slice(0, 10).map((d, index) => {
            const vendorInfo = getVendorInfo(d.vendor);
            const percentage = Math.min(100, Math.max(0, (d.score / maxScore) * 100));
            const rankStr = String(index + 1).padStart(2, "0");

            return (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.02 }}
                className="group relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border bg-card p-2.5 sm:px-4 sm:py-2.5 hover:border-border/80 hover:shadow-xs transition-all"
              >
                {/* Left: Rank & Identity */}
                <div className="flex items-center gap-3 sm:w-64 shrink-0">
                  <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors w-6">
                    {rankStr}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: vendorInfo.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground" title={d.name}>
                      {formatName(d.name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vendorInfo.label}
                    </p>
                  </div>
                </div>

                {/* Middle: Proportional Bar */}
                <div className="flex-1 relative flex items-center h-5">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      style={{ backgroundColor: vendorInfo.hex }}
                    />
                  </div>
                </div>

                {/* Right: Score */}
                <div className="flex items-center justify-end gap-1.5 sm:w-24 shrink-0 font-mono text-right">
                  <span className="text-xs font-semibold text-foreground">
                    {d.score.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {label.includes("%") ? "%" : "pts"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Recharts Column View */
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data.slice(0, 12)} margin={{ top: 12, right: 12, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.6} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(val) => formatName(val).slice(0, 14)}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxScore / 10) * 10]}
              label={{ value: label, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "var(--muted-foreground)" } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={26}>
              {data.slice(0, 12).map((d, i) => {
                const vendorInfo = getVendorInfo(d.vendor);
                return (
                  <Cell
                    key={i}
                    fill={vendorInfo.hex}
                    className="transition-opacity hover:opacity-85"
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
