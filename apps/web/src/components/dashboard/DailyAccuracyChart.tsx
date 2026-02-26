"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useTheme } from "next-themes";
import { fillDateGaps, formatShortDate } from "@/lib/chartUtils";
import { CHART_COLORS } from "@/lib/chartTheme";
import type { DailyTrendPoint } from "@/types/api";

interface DailyAccuracyChartProps {
  data: DailyTrendPoint[];
}

export function DailyAccuracyChart({ data }: DailyAccuracyChartProps) {
  const { resolvedTheme } = useTheme();
  const colors = CHART_COLORS[resolvedTheme === "dark" ? "dark" : "light"];

  const filled = fillDateGaps(data, 30);
  const chartData = filled.map((d) => ({
    date: formatShortDate(d.date),
    accuracy: Math.round(d.accuracy_rate * 100),
  }));

  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
          <TrendingUp className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          정답률 추이
        </h2>
        <span className="ml-auto text-xs font-semibold text-text-tertiary">
          최근 30일
        </span>
      </div>
      <div className="min-h-[200px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: colors.tick }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "정답률"]}
              contentStyle={{
                borderRadius: "0.75rem",
                border: `1px solid ${colors.tooltipBorder}`,
                backgroundColor: colors.tooltipBg,
                color: colors.tooltipText,
                fontSize: "0.75rem",
              }}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#accuracyGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#6366f1" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
