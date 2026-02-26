import type { QuizItem as QuizItemType } from "@/types/api";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, HelpCircle, ListOrdered, CheckSquare, PenTool, SkipForward } from "lucide-react";

interface QuizItemProps {
  item: QuizItemType;
  index: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onSkip?: () => void;
  isSkipped?: boolean;
  isFocused?: boolean;
}

const TYPE_CONFIG = {
  mcq: { label: "객관식", icon: ListOrdered, color: "text-blue-500", bg: "bg-blue-50" },
  true_false: { label: "O/X", icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-50" },
  fill_blank: { label: "빈칸 채우기", icon: PenTool, color: "text-purple-500", bg: "bg-purple-50" },
  short_answer: { label: "단답형", icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-50" },
};

export function QuizItem({
  item,
  index,
  value,
  onChange,
  disabled,
  onSkip,
  isSkipped,
  isFocused,
}: QuizItemProps) {
  const config = TYPE_CONFIG[item.quiz_type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.mcq;
  const Icon = config.icon;

  return (
    <div
      id={`quiz-item-${item.id}`}
      className={cn(
        "overflow-hidden rounded-[2rem] border bg-white dark:bg-slate-800 p-8 shadow-sm transition-all hover:shadow-md",
        isSkipped && !value ? "border-amber-200" : "border-slate-200 dark:border-slate-700",
        isFocused && "ring-2 ring-indigo-500 ring-offset-2 border-indigo-300",
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-black text-white shadow-sm">
            {index + 1}
          </span>
          <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset", config.bg, config.color, "ring-current/10")}>
            <Icon className="h-3 w-3" />
            {config.label}
          </div>
        </div>
      </div>

      <p className="mb-8 text-lg font-bold leading-relaxed text-slate-800 dark:text-slate-100">
        {item.question}
      </p>

      {item.quiz_type === "mcq" && item.options ? (
        <div role="radiogroup" aria-label={`문제 ${index + 1} 선택지`} className="grid grid-cols-1 gap-3">
          {Object.entries(item.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, text]) => {
              const isSelected = value === key;
              return (
                <label
                  key={key}
                  className={cn(
                    "group flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all duration-200",
                    isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700",
                    disabled && "pointer-events-none opacity-60"
                  )}
                >
                  <div className="mt-0.5 relative flex items-center justify-center">
                    <input
                      type="radio"
                      name={`q-${item.id}`}
                      value={key}
                      checked={isSelected}
                      onChange={() => onChange(key)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-indigo-600 animate-in zoom-in duration-300" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 group-hover:text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 text-sm font-semibold leading-relaxed">
                    <span className={cn("mr-2 inline-block w-4 font-black", isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")}>
                      {key}.
                    </span>
                    <span className={isSelected ? "text-indigo-900 dark:text-indigo-200" : "text-slate-600 dark:text-slate-300"}>{text}</span>
                  </div>
                </label>
              );
            })}
        </div>
      ) : item.quiz_type === "true_false" ? (
        <div role="radiogroup" aria-label={`문제 ${index + 1} O/X 선택`} className="flex gap-4">
          {["O", "X"].map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => !disabled && onChange(opt)}
                disabled={disabled}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center rounded-2xl border py-6 transition-all duration-200 active:scale-95",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-600"
                    : "border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300",
                  disabled && "pointer-events-none opacity-60"
                )}
              >
                <span className="text-3xl font-black">{opt}</span>
                <span className="mt-2 text-[10px] font-black uppercase tracking-widest">
                  {opt === "O" ? "True" : "False"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="답변을 상세히 입력하세요..."
            rows={3}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 px-5 py-4 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-100"
          />
          <div className="absolute right-4 bottom-4 text-slate-300">
            <PenTool className="h-4 w-4" />
          </div>
        </div>
      )}

      {!disabled && onSkip && !value && (
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "mt-6 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95",
            isSkipped
              ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-200"
              : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300",
          )}
        >
          <SkipForward className="h-3.5 w-3.5" />
          {isSkipped ? "건너뛴 문제" : "건너뛰기"}
        </button>
      )}
    </div>
  );
}
