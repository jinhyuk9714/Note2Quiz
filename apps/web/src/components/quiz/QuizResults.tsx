import type { SubmitResult, QuizItem as QuizItemType } from "@/types/api";
import { cn } from "@/lib/utils";

interface QuizResultsProps {
  result: SubmitResult;
  items: QuizItemType[];
}

export function QuizResults({ result, items }: QuizResultsProps) {
  const percentage = Math.round((result.score / result.total) * 100);

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-4xl font-bold text-indigo-600">
          {result.score} / {result.total}
        </p>
        <p className="mt-1 text-sm text-gray-500">{percentage}% 정답</p>
        {result.wrong_notes_created > 0 && (
          <p className="mt-2 text-sm text-amber-600">
            {result.wrong_notes_created}개 오답노트 생성됨
          </p>
        )}
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        {result.results.map((r, i) => {
          const item = items.find((q) => q.id === r.quiz_item_id);
          return (
            <div
              key={r.quiz_item_id}
              className={cn(
                "rounded-lg border px-4 py-3",
                r.is_correct
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50",
              )}
            >
              <p className="text-sm font-medium">
                Q{i + 1}. {item?.question ?? ""}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <span className="text-gray-500">내 답: </span>
                  <span className={r.is_correct ? "text-green-700" : "text-red-700"}>
                    {r.user_answer}
                  </span>
                </p>
                {!r.is_correct && (
                  <p>
                    <span className="text-gray-500">정답: </span>
                    <span className="font-medium text-green-700">
                      {r.correct_answer}
                    </span>
                  </p>
                )}
                {(r.explanation || item?.explanation) && (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                    <span className="font-medium">해설: </span>
                    {r.explanation || item?.explanation}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
