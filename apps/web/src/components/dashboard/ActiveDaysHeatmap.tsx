import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyTrendPoint } from "@/types/api";

interface ActiveDaysHeatmapProps {
  data: DailyTrendPoint[];
}

const INTENSITY_CLASSES = [
  "bg-surface-alt ring-1 ring-inset ring-border-default/50 dark:bg-slate-700 dark:ring-slate-600/40",
  "bg-indigo-100 dark:bg-indigo-800",
  "bg-indigo-200 dark:bg-indigo-600",
  "bg-indigo-300 dark:bg-indigo-500",
  "bg-indigo-400 dark:bg-indigo-400",
  "bg-indigo-600 dark:bg-indigo-300",
] as const;

function intensityClass(quizCount: number, maxCount: number): string {
  if (quizCount === 0 || maxCount === 0) return INTENSITY_CLASSES[0];
  const level = Math.ceil((quizCount / maxCount) * 5);
  return INTENSITY_CLASSES[Math.min(level, 5)];
}

function buildCells(data: DailyTrendPoint[], days: number) {
  const map = new Map(data.map((d) => [d.date, d.quiz_count]));
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLabel = new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
    }).format(d);
    cells.push({ date: key, count: map.get(key) ?? 0, label: dayLabel });
  }
  return cells;
}

export function ActiveDaysHeatmap({ data }: ActiveDaysHeatmapProps) {
  const cells = useMemo(() => buildCells(data, 30), [data]);
  const maxCount = useMemo(() => Math.max(...cells.map((c) => c.count), 0), [cells]);
  const activeDays = useMemo(() => cells.filter((c) => c.count > 0).length, [cells]);

  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          활동 히트맵
        </h2>
        <span className="ml-auto text-xs font-semibold text-text-tertiary">
          {activeDays}일 활동
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {cells.map(({ date, count, label }) => (
          <div
            key={date}
            title={`${label}: ${count}회`}
            className={cn(
              "aspect-square rounded-lg transition-opacity hover:opacity-80",
              intensityClass(count, maxCount),
            )}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-text-tertiary font-medium">
        <span>적음</span>
        <div className="flex gap-1">
          {INTENSITY_CLASSES.map((c) => (
            <div key={c} className={cn("h-3 w-3 rounded-sm", c)} />
          ))}
        </div>
        <span>많음</span>
      </div>
    </div>
  );
}
