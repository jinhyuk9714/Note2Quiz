import { cn } from "@/lib/utils";

interface MasteryProgressProps {
  consecutiveCorrect: number;
  isMastered: boolean;
  easeFactor?: number;
}

const MASTERY_THRESHOLD = 5;

export function MasteryProgress({ consecutiveCorrect, isMastered, easeFactor }: MasteryProgressProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: MASTERY_THRESHOLD }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors duration-300",
            i < consecutiveCorrect
              ? isMastered
                ? "bg-emerald-500"
                : "bg-indigo-500"
              : "bg-border-default",
          )}
        />
      ))}
      {isMastered && (
        <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
          Mastered
        </span>
      )}
      {!isMastered && easeFactor !== undefined && (
        <span className="ml-1 text-[10px] font-medium text-text-tertiary">
          EF {easeFactor.toFixed(1)}
        </span>
      )}
    </div>
  );
}
