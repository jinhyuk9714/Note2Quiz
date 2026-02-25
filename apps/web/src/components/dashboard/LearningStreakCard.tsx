import { Flame, CalendarDays, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreakStats } from "@/types/api";

interface LearningStreakCardProps {
  streak: StreakStats;
}

export function LearningStreakCard({ streak }: LearningStreakCardProps) {
  const isActive = streak.current_streak_days > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            isActive ? "bg-orange-50 text-orange-500" : "bg-slate-50 text-slate-400",
          )}
        >
          <Flame className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">학습 스트릭</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
        <p
          className={cn(
            "text-6xl font-black tracking-tighter",
            isActive ? "text-orange-500" : "text-slate-300",
          )}
        >
          {streak.current_streak_days}
        </p>
        <p className="mt-2 text-sm font-bold text-slate-500">
          {isActive ? "일 연속 학습 중" : "오늘 첫 퀴즈를 풀어보세요!"}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200/50">
          <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">최장 기록</p>
            <p className="text-lg font-black text-slate-800">{streak.longest_streak_days}일</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200/50">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">총 활동일</p>
            <p className="text-lg font-black text-slate-800">{streak.total_active_days}일</p>
          </div>
        </div>
      </div>
    </div>
  );
}
