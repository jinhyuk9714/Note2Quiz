import type { QuizItem as QuizItemType } from "@/types/api";
import { cn } from "@/lib/utils";

interface QuizItemProps {
  item: QuizItemType;
  index: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function QuizItem({
  item,
  index,
  value,
  onChange,
  disabled,
}: QuizItemProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="mb-1 text-xs font-medium text-gray-400">
        Q{index + 1} ·{" "}
        {item.quiz_type === "mcq"
          ? "객관식"
          : item.quiz_type === "true_false"
            ? "O/X"
            : item.quiz_type === "fill_blank"
              ? "빈칸 채우기"
              : "단답형"}
      </p>
      <p className="mb-4 text-sm font-medium leading-relaxed">
        {item.question}
      </p>

      {item.quiz_type === "mcq" && item.options ? (
        <div className="space-y-2">
          {Object.entries(item.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, text]) => (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                  value === key
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:bg-gray-50",
                  disabled && "cursor-default opacity-60",
                )}
              >
                <input
                  type="radio"
                  name={`q-${item.id}`}
                  value={key}
                  checked={value === key}
                  onChange={() => onChange(key)}
                  disabled={disabled}
                  className="accent-indigo-600"
                />
                <span className="font-medium text-gray-500">{key}.</span>
                <span>{text}</span>
              </label>
            ))}
        </div>
      ) : item.quiz_type === "true_false" ? (
        <div className="flex gap-3">
          {["O", "X"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => !disabled && onChange(opt)}
              disabled={disabled}
              className={cn(
                "flex-1 rounded-md border py-2 text-sm font-medium transition-colors",
                value === opt
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
                disabled && "cursor-default opacity-60",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="답을 입력하세요"
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
        />
      )}
    </div>
  );
}
