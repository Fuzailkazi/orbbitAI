import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, BookOpen, Play, LayoutGrid } from "lucide-react";

const stats = [
  { label: "Models", value: "177", icon: Layers },
  { label: "Benchmarks", value: "18", icon: BookOpen },
  { label: "Evaluations", value: "0", icon: Play },
  { label: "Spaces", value: "6", icon: LayoutGrid },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-50">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          AI model evaluation at a glance.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-[#1E293B] bg-[#111827]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-50">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-[#1E293B] bg-[#111827]">
        <CardHeader>
          <CardTitle className="text-gray-50">Recent Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No evaluations yet. Run your first evaluation to see results here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
