import type { QuizItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { SkipForward, CheckCircle2, Circle } from "lucide-react";

interface QuestionNavPanelProps {
  items: QuizItem[];
  answers: Record<string, string>;
  skippedIds: Set<string>;
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export function QuestionNavPanel({
  items,
  answers,
  skippedIds,
  currentIndex,
  onNavigate,
}: QuestionNavPanelProps) {
  function scrollTo(itemId: string) {
    document
      .getElementById(`quiz-item-${itemId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const answeredCount = items.filter((i) => !!answers[i.id]).length;
  const skippedCount = items.filter(
    (i) => skippedIds.has(i.id) && !answers[i.id],
  ).length;

  return (
    <div className="bento-card p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-tertiary">
          문항 이동
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-bold text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200 dark:shadow-none" />
            답변 {answeredCount}
          </span>
          {skippedCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-200 dark:shadow-none" />
              건너뜀 {skippedCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {items.map((item, idx) => {
          const hasAnswer = !!answers[item.id];
          const isSkipped = skippedIds.has(item.id) && !hasAnswer;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                scrollTo(item.id);
                onNavigate?.(idx);
              }}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-all active:scale-90 shadow-sm",
                hasAnswer
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                  : isSkipped
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-300 dark:ring-amber-800"
                    : "bg-surface-alt text-text-secondary ring-1 ring-inset ring-border-default hover:bg-surface-card hover:text-text-primary hover:border-indigo-300",
                idx === currentIndex && "ring-2 ring-indigo-500 ring-offset-2 scale-110",
              )}
              title={
                hasAnswer
                  ? `${idx + 1}번 (답변완료)`
                  : isSkipped
                    ? `${idx + 1}번 (건너뜀)`
                    : `${idx + 1}번`
              }
            >
              {idx + 1}
              {hasAnswer && (
                <CheckCircle2 className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-white text-indigo-600 shadow-sm" />
              )}
              {isSkipped && (
                <SkipForward className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-white text-amber-500 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {items.length > 10 && (
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
          <Circle className="h-3 w-3" />
          번호를 클릭하면 해당 문항으로 이동합니다
        </div>
      )}
    </div>
  );
}
