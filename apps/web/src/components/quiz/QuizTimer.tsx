"use client";

import { Timer, TimerOff } from "lucide-react";

interface QuizTimerProps {
  elapsedSec: number;
  enabled: boolean;
  onToggle: () => void;
}

export function QuizTimer({ elapsedSec, enabled, onToggle }: QuizTimerProps) {
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 transition-all hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        title={enabled ? "타이머 숨기기" : "타이머 보기"}
      >
        {enabled ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />}
      </button>
      {enabled && (
        <span className="text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
