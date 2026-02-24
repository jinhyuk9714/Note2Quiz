"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteQuiz } from "@/lib/api";
import type { QuizListItem } from "@/types/api";
import { formatDate } from "@/lib/utils";

interface QuizHistoryCardProps {
  quiz: QuizListItem;
}

export function QuizHistoryCard({ quiz }: QuizHistoryCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteQuiz(quiz.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
  });

  function handleDelete() {
    if (!window.confirm(`"${quiz.title}" 퀴즈를 삭제하시겠습니까?`)) return;
    mutation.mutate();
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div>
        <h3 className="text-sm font-medium">{quiz.title}</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {quiz.item_count}문제 · {formatDate(quiz.created_at)}
        </p>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-500">
            {mutation.error.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/quiz/${quiz.id}`)}
          className="rounded-md border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          보기
        </button>
        <button
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {mutation.isPending ? "..." : "삭제"}
        </button>
      </div>
    </div>
  );
}
