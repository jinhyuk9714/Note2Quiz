"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { getQuizForStudy } from "@/lib/api";
import { FlashcardSession } from "@/components/quiz/FlashcardSession";

export default function FlashcardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ["quiz-study", id],
    queryFn: () => getQuizForStudy(id),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <BookOpenCheck className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-text-tertiary">플래시카드를 준비하는 중...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">퀴즈를 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          {error instanceof Error ? error.message : "존재하지 않거나 삭제된 퀴즈입니다."}
        </p>
        <Link
          href="/quiz/history"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-surface-alt px-6 py-3 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt/80"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20">
      <FlashcardSession
        items={quiz.items}
        quizTitle={quiz.title}
        onExit={() => router.push("/quiz/history")}
      />
    </div>
  );
}
