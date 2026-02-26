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
        "bento-card p-10 transition-all duration-300",
        isSkipped && !value ? "border-amber-300 bg-amber-50/20" : "",
        isFocused ? "ring-4 ring-indigo-600/10 border-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-none" : "",
      )}
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-text-primary text-sm font-black text-surface-card shadow-sm">
            {index + 1}
          </span>
          <div className={cn("flex items-center gap-2 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset", config.bg, config.color, "ring-current/10")}>
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </div>
        </div>
      </div>

      <p className="mb-10 text-xl font-black leading-snug text-text-primary tracking-tight">
        {item.question}
      </p>

      {item.quiz_type === "mcq" && item.options ? (
        <div role="radiogroup" aria-label={`문제 ${index + 1} 선택지`} className="grid grid-cols-1 gap-4">
          {Object.entries(item.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, text]) => {
              const isSelected = value === key;
              return (
                <label
                  key={key}
                  className={cn(
                    "group flex cursor-pointer items-start gap-5 rounded-2xl border p-5 transition-all duration-300",
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-600 dark:shadow-none"
                      : "border-border-default bg-surface-alt hover:border-indigo-300 hover:bg-surface-card",
                    disabled && "pointer-events-none opacity-60"
                  )}
                >
                  <div className="mt-1 relative flex items-center justify-center shrink-0">
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
                      <CheckCircle2 className="h-6 w-6 text-indigo-600 animate-in zoom-in duration-300" />
                    ) : (
                      <Circle className="h-6 w-6 text-text-tertiary group-hover:text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 text-base font-bold leading-relaxed">
                    <span className={cn("mr-3 inline-block w-5 font-black uppercase tracking-tighter", isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-text-tertiary")}>
                      {key}
                    </span>
                    <span className={isSelected ? "text-indigo-950 dark:text-indigo-100" : "text-text-secondary group-hover:text-text-primary"}>{text}</span>
                  </div>
                </label>
              );
            })}
        </div>
      ) : item.quiz_type === "true_false" ? (
        <div role="radiogroup" aria-label={`문제 ${index + 1} O/X 선택`} className="flex gap-6">
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
                  "flex-1 flex flex-col items-center justify-center rounded-3xl border py-8 transition-all duration-300 active:scale-95",
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none ring-1 ring-indigo-600"
                    : "border-border-default bg-surface-alt text-text-tertiary hover:border-indigo-300 hover:bg-surface-card hover:text-indigo-600",
                  disabled && "pointer-events-none opacity-60"
                )}
              >
                <span className="text-5xl font-black">{opt}</span>
                <span className={cn("mt-3 text-[10px] font-black uppercase tracking-[0.2em]", isSelected ? "text-indigo-100" : "text-text-tertiary")}>
                  {opt === "O" ? "True" : "False"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="relative group">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="답변을 입력하세요..."
            rows={5}
            className="w-full rounded-3xl border border-border-default bg-surface-alt px-8 py-8 text-lg font-bold transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 disabled:opacity-60 placeholder:text-text-tertiary text-text-primary leading-relaxed"
          />
          <div className="absolute right-6 bottom-6 text-text-tertiary group-focus-within:text-indigo-600 transition-colors">
            <PenTool className="h-6 w-6" />
          </div>
        </div>
      )}

      {!disabled && onSkip && !value && (
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "mt-8 flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95",
            isSkipped
              ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300 shadow-sm"
              : "text-text-tertiary hover:bg-surface-alt hover:text-text-primary",
          )}
        >
          <SkipForward className="h-4 w-4" />
          {isSkipped ? "Skipped Question" : "Skip Question"}
        </button>
      )}
    </div>
  );
}
