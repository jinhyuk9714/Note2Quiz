"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { fillDateGaps, formatShortDate } from "@/lib/chartUtils";
import type { DailyTrendPoint } from "@/types/api";

interface ActivityBarChartProps {
  data: DailyTrendPoint[];
}

export function ActivityBarChart({ data }: ActivityBarChartProps) {
  const filled = fillDateGaps(data, 30);
  const chartData = filled.map((d) => ({
    date: formatShortDate(d.date),
    quizzes: d.quiz_count,
    fill: d.quiz_count > 0 ? "#818cf8" : "#e2e8f0",
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Activity className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">
          일별 학습량
        </h2>
        <span className="ml-auto text-xs font-semibold text-slate-400">
          최근 30일
        </span>
      </div>
      <div className="min-h-[160px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => [value, "퀴즈 수"]}
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.75rem",
              }}
            />
            <Bar
              dataKey="quizzes"
              radius={[4, 4, 0, 0]}
              maxBarSize={20}
              fill="#818cf8"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
