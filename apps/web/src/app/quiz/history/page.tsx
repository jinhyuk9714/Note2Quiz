"use client";

import { useQuery } from "@tanstack/react-query";
import { History, LayoutGrid, Sparkles } from "lucide-react";
import { listQuizzes } from "@/lib/api";
import { QuizHistoryCard } from "@/components/quiz/QuizHistoryCard";
import Link from "next/link";

export default function QuizHistoryPage() {
  const { data: quizzes, isLoading, error } = useQuery({
    queryKey: ["quizzes"],
    queryFn: listQuizzes,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          퀴즈 기록
        </h1>
        <p className="text-slate-500 font-medium">
          지금까지 풀었던 모든 퀴즈 목록을 확인하고 복습하세요.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800">내 퀴즈 보관함</h2>
          </div>
          {quizzes && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
              총 {quizzes.length}개
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[2rem] bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center text-sm font-bold text-red-600">
            {error instanceof Error ? error.message : "오류가 발생했습니다"}
          </div>
        ) : quizzes && quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-20 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
              <History className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">생성된 퀴즈가 없습니다</h3>
            <p className="mt-2 text-sm font-medium text-slate-500 max-w-xs mx-auto">
              아직 도전한 퀴즈가 없네요! 학습 문서를 업로드하고 첫 번째 퀴즈를 생성해보세요.
            </p>
            <Link 
              href="/quiz/generate"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              첫 퀴즈 생성하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {quizzes?.map((quiz) => (
              <QuizHistoryCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
