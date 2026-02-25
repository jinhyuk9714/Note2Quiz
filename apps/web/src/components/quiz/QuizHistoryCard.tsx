"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { History, Trash2, ChevronRight, Calendar, Layers, AlertCircle, Trophy, RotateCcw } from "lucide-react";
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

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`"${quiz.title}" 퀴즈를 삭제하시겠습니까?`)) return;
    mutation.mutate();
  }

  return (
    <div 
      onClick={() => router.push(`/quiz/${quiz.id}`)}
      className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg active:scale-[0.99] cursor-pointer"
    >
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 shadow-sm ring-1 ring-inset ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
          <History className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
            {quiz.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Layers className="h-3.5 w-3.5" />
              {quiz.item_count}문제
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(quiz.created_at)}
            </div>
            {quiz.attempt_count > 0 && (
              <>
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-500">
                  <Trophy className="h-3.5 w-3.5" />
                  {quiz.latest_score}/{quiz.latest_total}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {quiz.attempt_count}회 풀이
                </div>
              </>
            )}
          </div>
          {mutation.isError && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-red-500">
              <AlertCircle className="h-3 w-3" />
              {mutation.error.message}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full sm:w-auto items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="삭제"
        >
          {mutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:translate-x-1 transition-transform">
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
