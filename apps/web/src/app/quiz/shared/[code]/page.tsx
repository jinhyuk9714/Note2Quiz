"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpenCheck,
  AlertCircle,
  Copy,
  User,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getSharedQuiz, submitSharedQuiz, copySharedQuiz } from "@/lib/api";
import { QuizItem } from "@/components/quiz/QuizItem";
import { QuizResults } from "@/components/quiz/QuizResults";
import { cn, formatDate } from "@/lib/utils";
import type { SharedQuiz, SubmitResult, AnswerItem } from "@/types/api";

type Phase = "taking" | "submitting" | "results";

export default function SharedQuizPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const {
    data: quiz,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shared-quiz", code],
    queryFn: () => getSharedQuiz(code),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <BookOpenCheck className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-text-tertiary">공유 퀴즈를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">퀴즈를 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          공유가 중단되었거나 잘못된 링크입니다.
        </p>
        <Link
          href="/quiz/history"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-surface-alt px-6 py-3 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt/80"
        >
          내 퀴즈 목록으로
        </Link>
      </div>
    );
  }

  return <SharedQuizTaker quiz={quiz} shareCode={code} router={router} />;
}

function SharedQuizTaker({
  quiz,
  shareCode,
  router,
}: {
  quiz: SharedQuiz;
  shareCode: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [phase, setPhase] = useState<Phase>("taking");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const submitMutation = useMutation({
    mutationFn: (answerItems: AnswerItem[]) => submitSharedQuiz(shareCode, answerItems),
    onSuccess: (data) => {
      setResult(data);
      setPhase("results");
    },
    onError: () => toast.error("제출에 실패했습니다"),
  });

  const copyMutation = useMutation({
    mutationFn: () => copySharedQuiz(shareCode),
    onSuccess: (data) => {
      toast.success("퀴즈가 내 계정으로 복제되었습니다");
      router.push(`/quiz/${data.quiz_id}`);
    },
    onError: () => toast.error("복제에 실패했습니다"),
  });

  const handleAnswer = useCallback(
    (itemId: string, answer: string) => {
      setAnswers((prev) => ({ ...prev, [itemId]: answer }));
    },
    [],
  );

  function handleSubmit() {
    const answerItems: AnswerItem[] = quiz.items.map((item) => ({
      quiz_item_id: item.id,
      user_answer: answers[item.id] ?? "",
    }));
    setPhase("submitting");
    submitMutation.mutate(answerItems);
  }

  const currentItem = quiz.items[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === quiz.items.length;

  if (phase === "results" && result) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <QuizResults result={result} items={quiz.items} />

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            {copyMutation.isPending ? "복제 중..." : "내 계정으로 복제"}
          </button>
          <Link
            href="/quiz/history"
            className="inline-flex items-center gap-2 rounded-2xl bg-surface-alt px-6 py-3 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt/80"
          >
            내 퀴즈 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      {/* Header */}
      <div className="rounded-2xl bg-surface-card border border-border-default p-6">
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
          <User className="h-3.5 w-3.5" />
          <span>{quiz.owner_display_name}님이 공유한 퀴즈</span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">{quiz.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-text-secondary">
          <span>{quiz.item_count}문항</span>
          <span>·</span>
          <span>{formatDate(quiz.created_at)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-text-secondary">
          {currentIndex + 1} / {quiz.items.length}
        </span>
        <span className="text-sm text-text-tertiary">
          {answeredCount}문항 답변 완료
        </span>
      </div>

      {/* Question */}
      {currentItem && (
        <QuizItem
          item={currentItem}
          index={currentIndex}
          value={answers[currentItem.id] ?? ""}
          onChange={(val) => handleAnswer(currentItem.id, val)}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </button>

        {currentIndex === quiz.items.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || phase === "submitting"}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all",
              allAnswered
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-surface-alt text-text-tertiary cursor-not-allowed",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {phase === "submitting" ? "제출 중..." : "제출"}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(quiz.items.length - 1, i + 1))}
            className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:bg-surface-alt"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap justify-center gap-1.5 pt-2">
        {quiz.items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "h-8 w-8 rounded-lg text-xs font-bold transition-all",
              i === currentIndex
                ? "bg-indigo-600 text-white"
                : answers[item.id]
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-surface-alt text-text-tertiary hover:bg-surface-alt/80",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Copy button */}
      <div className="flex justify-center pt-4 border-t border-border-default">
        <button
          onClick={() => copyMutation.mutate()}
          disabled={copyMutation.isPending}
          className="flex items-center gap-2 text-sm font-medium text-text-tertiary hover:text-indigo-600 transition-colors"
        >
          <Copy className="h-4 w-4" />
          {copyMutation.isPending ? "복제 중..." : "내 계정으로 복제하기"}
        </button>
      </div>
    </div>
  );
}
