"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CheckCircle2, BookOpenCheck, Sparkles, AlertCircle, RotateCcw, History } from "lucide-react";
import { getQuiz, submitQuiz, listQuizAttempts } from "@/lib/api";
import { QuizItem } from "@/components/quiz/QuizItem";
import { QuizResults } from "@/components/quiz/QuizResults";
import type { SubmitResult } from "@/types/api";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";

type Phase = "taking" | "submitting" | "results";

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => getQuiz(id),
  });

  const { data: attempts } = useQuery({
    queryKey: ["quiz-attempts", id],
    queryFn: () => listQuizAttempts(id),
    enabled: phase === "results",
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitQuiz(
        id,
        Object.entries(answers).map(([quiz_item_id, user_answer]) => ({
          quiz_item_id,
          user_answer,
        })),
      ),
    onMutate: () => setPhase("submitting"),
    onSuccess: (data) => {
      setResult(data);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
      void queryClient.invalidateQueries({ queryKey: ["quiz-attempts", id] });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: () => setPhase("taking"),
  });

  function handleRetake() {
    setAnswers({});
    setResult(null);
    setPhase("taking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <BookOpenCheck className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-slate-400">퀴즈 문항을 불러오는 중...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">퀴즈를 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {error instanceof Error ? error.message : "존재하지 않거나 삭제된 퀴즈입니다."}
        </p>
        <Link
          href="/quiz/history"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = quiz.items.length;
  const allAnswered = answeredCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href="/quiz/history"
            className="group mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-indigo-600"
          >
            <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Back to Library
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{quiz.title}</h1>
          <p className="text-slate-500 font-medium">
            {phase === "results" ? "퀴즈 결과 분석" : "문제를 정독하고 정답을 선택하세요."}
          </p>
        </div>

        {phase === "taking" && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 text-sm font-black text-indigo-600">
              <span className="text-2xl">{answeredCount}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-400">{totalCount}</span>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {phase === "results" && result ? (
        <div className="space-y-10 animate-in fade-in duration-700">
          <QuizResults result={result} items={quiz.items} />

          {attempts && attempts.length > 1 && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <History className="h-5 w-5 text-indigo-600" />
                풀이 기록
              </h3>
              <div className="space-y-2">
                {attempts.map((a) => (
                  <div
                    key={a.attempt_id}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-4 py-3",
                      a.attempt_id === result.attempt_id
                        ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                        : "bg-slate-50",
                    )}
                  >
                    <span className="text-sm font-bold text-slate-600">
                      {a.attempt_number}회차
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {a.score}/{a.total}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {formatDate(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push("/wrong-notes")}
              className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-white border border-slate-200 py-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
            >
              <BookOpenCheck className="h-4 w-4 text-indigo-500" />
              오답노트로 복습하기
            </button>
            <button
              onClick={handleRetake}
              className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-amber-500 py-5 text-sm font-bold text-white shadow-lg shadow-amber-200 transition-all hover:bg-amber-600 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" />
              다시 풀기
            </button>
            <button
              onClick={() => router.push("/quiz/generate")}
              className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-indigo-600 py-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              새로운 퀴즈 생성
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-6">
            {quiz.items.map((item, i) => (
              <QuizItem
                key={item.id}
                item={item}
                index={i}
                value={answers[item.id] ?? ""}
                onChange={(val) =>
                  setAnswers((prev) => ({ ...prev, [item.id]: val }))
                }
                disabled={phase !== "taking"}
              />
            ))}
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={!allAnswered || phase === "submitting"}
            className={cn(
              "group sticky bottom-6 z-20 w-full flex items-center justify-center gap-3 rounded-[2rem] py-6 text-lg font-black text-white shadow-2xl transition-all active:scale-[0.98]",
              allAnswered
                ? "bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700"
                : "bg-slate-300 cursor-not-allowed opacity-80"
            )}
          >
            {phase === "submitting" ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                채점 분석 중...
              </>
            ) : (
              <>
                퀴즈 제출하고 점수 확인
                <CheckCircle2 className={cn("h-6 w-6 transition-transform", allAnswered && "group-hover:scale-125")} />
              </>
            )}
          </button>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {mutation.error.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
