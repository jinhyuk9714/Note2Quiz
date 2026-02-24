"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQuiz, submitQuiz } from "@/lib/api";
import { QuizItem } from "@/components/quiz/QuizItem";
import { QuizResults } from "@/components/quiz/QuizResults";
import type { SubmitResult } from "@/types/api";

type Phase = "taking" | "submitting" | "results";

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => getQuiz(id),
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
    },
    onError: () => setPhase("taking"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">퀴즈 로딩 중...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "퀴즈를 찾을 수 없습니다"}
        </p>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = quiz.items.length;
  const allAnswered = answeredCount === totalCount;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
        {phase === "taking" && (
          <span className="text-sm text-gray-500">
            {answeredCount} / {totalCount} 답변
          </span>
        )}
      </div>

      {phase === "results" && result ? (
        <>
          <QuizResults result={result} items={quiz.items} />
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/wrong-notes")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              오답노트 보기
            </button>
            <button
              onClick={() => router.push("/quiz/generate")}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              새 퀴즈 생성
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-4">
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
            className="w-full rounded-md bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "submitting" ? "채점 중..." : "제출하기"}
          </button>

          {mutation.isError && (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
          )}
        </>
      )}
    </div>
  );
}
