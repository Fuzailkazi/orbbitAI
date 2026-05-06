"use client";

import { TopModelsChart } from "@/components/charts/top-models-chart";

interface DashboardChartsProps {
  data: Array<{
    name: string;
    score: number;
    vendor: string;
  }>;
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  return <TopModelsChart data={data} label="Accuracy %" height={280} />;
}
