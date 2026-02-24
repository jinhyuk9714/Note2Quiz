"use client";

import { useQuery } from "@tanstack/react-query";
import { listQuizzes } from "@/lib/api";
import { QuizHistoryCard } from "@/components/quiz/QuizHistoryCard";

export default function QuizHistoryPage() {
  const { data: quizzes, isLoading, error } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">퀴즈 기록</h1>

      {isLoading && <p className="text-sm text-gray-500">로딩 중...</p>}

      {error && (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "오류가 발생했습니다"}
        </p>
      )}

      {quizzes && quizzes.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">
          아직 생성된 퀴즈가 없습니다.
        </p>
      )}

      {quizzes && quizzes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{quizzes.length}개</p>
          {quizzes.map((quiz) => (
            <QuizHistoryCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  );
}
