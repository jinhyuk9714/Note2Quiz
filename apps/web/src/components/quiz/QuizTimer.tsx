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
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-alt text-text-tertiary transition-all hover:bg-surface-alt/80 hover:text-text-secondary"
        title={enabled ? "타이머 숨기기" : "타이머 보기"}
      >
        {enabled ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />}
      </button>
      {enabled && (
        <span className="text-sm font-bold tabular-nums text-text-secondary">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
