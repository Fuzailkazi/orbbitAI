"use client";

import { AccuracyBarChart } from "@/components/charts/accuracy-bar-chart";

interface ModelBenchmarkChartProps {
  data: Array<{
    name: string;
    accuracy: number;
    ci_lower: number;
    ci_upper: number;
  }>;
}

export function ModelBenchmarkChart({ data }: ModelBenchmarkChartProps) {
  if (data.length === 0) return null;
  return <AccuracyBarChart data={data} height={Math.max(200, data.length * 44)} />;
}
