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
import { useTheme } from "next-themes";
import { fillDateGaps, formatShortDate } from "@/lib/chartUtils";
import { CHART_COLORS } from "@/lib/chartTheme";
import type { DailyTrendPoint } from "@/types/api";

interface ActivityBarChartProps {
  data: DailyTrendPoint[];
}

export function ActivityBarChart({ data }: ActivityBarChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = CHART_COLORS[resolvedTheme === "dark" ? "dark" : "light"];

  const filled = fillDateGaps(data, 30);
  const chartData = filled.map((d) => ({
    date: formatShortDate(d.date),
    quizzes: d.quiz_count,
  }));

  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
          <Activity className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          일별 학습량
        </h2>
        <span className="ml-auto text-xs font-semibold text-text-tertiary">
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
              stroke={colors.grid}
              vertical={false}
              syncWithTicks
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: colors.tick }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: colors.tick }}
              tickLine={false}
              axisLine={false}
              tickCount={6}
            />
            <Tooltip
              formatter={(value) => [value, "퀴즈 수"]}
              contentStyle={{
                borderRadius: "0.75rem",
                border: `1px solid ${colors.tooltipBorder}`,
                backgroundColor: colors.tooltipBg,
                color: colors.tooltipText,
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
