import { Flame, CalendarDays, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreakStats } from "@/types/api";

interface LearningStreakCardProps {
  streak: StreakStats;
}

export function LearningStreakCard({ streak }: LearningStreakCardProps) {
  const isActive = streak.current_streak_days > 0;

  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            isActive ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400" : "bg-surface-alt text-text-tertiary",
          )}
        >
          <Flame className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">학습 스트릭</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
        <p
          className={cn(
            "text-6xl font-black tracking-tighter",
            isActive ? "text-orange-500 dark:text-orange-400" : "text-text-tertiary",
          )}
        >
          {streak.current_streak_days}
        </p>
        <p className="mt-2 text-sm font-bold text-text-tertiary">
          {isActive ? "일 연속 학습 중" : "오늘 첫 퀴즈를 풀어보세요!"}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-alt px-4 py-3 ring-1 ring-inset ring-border-default">
          <Trophy className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-tertiary">최장 기록</p>
            <p className="text-lg font-black text-text-primary">{streak.longest_streak_days}일</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-surface-alt px-4 py-3 ring-1 ring-inset ring-border-default">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-tertiary">총 활동일</p>
            <p className="text-lg font-black text-text-primary">{streak.total_active_days}일</p>
          </div>
        </div>
      </div>
    </div>
  );
}
