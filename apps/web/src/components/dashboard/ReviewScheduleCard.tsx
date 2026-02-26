import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReviewScheduleStats } from "@/types/api";

interface ReviewScheduleCardProps {
  schedule: ReviewScheduleStats;
}

function formatKoreanDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

export function ReviewScheduleCard({ schedule }: ReviewScheduleCardProps) {
  const hasWork = schedule.overdue_count > 0 || schedule.today_count > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-border-default bg-surface-card p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
          <Calendar className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">복습 스케줄</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-2xl p-4 transition-all",
            schedule.overdue_count > 0
              ? "bg-red-50 dark:bg-red-900/20 ring-1 ring-inset ring-red-200/50 dark:ring-red-800/50"
              : "bg-surface-alt ring-1 ring-inset ring-border-default",
          )}
        >
          <p className="text-xs font-bold text-text-tertiary">기한 지남</p>
          <p
            className={cn(
              "mt-1 text-3xl font-black",
              schedule.overdue_count > 0 ? "text-red-600 dark:text-red-400" : "text-text-tertiary",
            )}
          >
            {schedule.overdue_count}
          </p>
        </div>
        <div
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-2xl p-4 transition-all",
            schedule.today_count > 0
              ? "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-inset ring-amber-200/50 dark:ring-amber-800/50"
              : "bg-surface-alt ring-1 ring-inset ring-border-default",
          )}
        >
          <p className="text-xs font-bold text-text-tertiary">오늘 복습</p>
          <p
            className={cn(
              "mt-1 text-3xl font-black",
              schedule.today_count > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-tertiary",
            )}
          >
            {schedule.today_count}
          </p>
        </div>
      </div>

      <div className="mt-8 flex-1">
        <div className="mb-4 flex items-center gap-2 px-1">
          <Clock className="h-4 w-4 text-text-tertiary" />
          <p className="text-[11px] font-black text-text-tertiary uppercase tracking-[0.1em]">주간 계획</p>
        </div>

        {schedule.upcoming.length > 0 ? (
          <ul className="space-y-2">
            {schedule.upcoming.map((day) => (
              <li
                key={day.date}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-surface-alt/50 px-4 py-3 text-sm transition-all hover:border-border-default hover:bg-surface-card"
              >
                <span className="font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
                  {formatKoreanDate(day.date)}
                </span>
                <span className="rounded-lg bg-surface-card px-2.5 py-1 text-xs font-bold text-text-secondary shadow-sm ring-1 ring-border-default group-hover:ring-indigo-200 dark:group-hover:ring-indigo-800 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all">
                  {day.count}개
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm font-medium text-text-tertiary italic">예정된 복습 일정이 없습니다.</p>
          </div>
        )}
      </div>

      {hasWork && (
        <Link
          href="/review"
          className="group mt-8 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 dark:hover:shadow-indigo-900/40 active:scale-95"
        >
          복습 시작하기
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
