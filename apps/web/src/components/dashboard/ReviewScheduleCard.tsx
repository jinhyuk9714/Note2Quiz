import Link from "next/link";

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
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">복습 스케줄</h2>

      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "rounded-md p-3 text-center",
            schedule.overdue_count > 0
              ? "border border-red-200 bg-red-50"
              : "bg-gray-50",
          )}
        >
          <p className="text-xs text-gray-500">기한 지남</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              schedule.overdue_count > 0 ? "text-red-600" : "text-gray-400",
            )}
          >
            {schedule.overdue_count}
          </p>
        </div>
        <div
          className={cn(
            "rounded-md p-3 text-center",
            schedule.today_count > 0
              ? "border border-amber-200 bg-amber-50"
              : "bg-gray-50",
          )}
        >
          <p className="text-xs text-gray-500">오늘 복습</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              schedule.today_count > 0 ? "text-amber-600" : "text-gray-400",
            )}
          >
            {schedule.today_count}
          </p>
        </div>
      </div>

      {schedule.upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-500">다음 7일</p>
          <ul className="space-y-1">
            {schedule.upcoming.map((day) => (
              <li
                key={day.date}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
              >
                <span className="text-gray-600">
                  {formatKoreanDate(day.date)}
                </span>
                <span className="font-medium">{day.count}개</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWork && (
        <Link
          href="/wrong-notes"
          className="block rounded-md bg-indigo-600 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          복습 시작하기
        </Link>
      )}
    </div>
  );
}
