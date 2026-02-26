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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
          문항 이동
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            답변 {answeredCount}
          </span>
          {skippedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              건너뜀 {skippedCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
                "relative flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all active:scale-90",
                hasAnswer
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : isSkipped
                    ? "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200"
                    : "bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 hover:text-slate-600",
                idx === currentIndex && "ring-2 ring-indigo-400 ring-offset-1 scale-110",
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
                <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-indigo-600" />
              )}
              {isSkipped && (
                <SkipForward className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {items.length > 10 && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
          <Circle className="h-2.5 w-2.5" />
          번호를 클릭하면 해당 문항으로 이동합니다
        </div>
      )}
    </div>
  );
}
