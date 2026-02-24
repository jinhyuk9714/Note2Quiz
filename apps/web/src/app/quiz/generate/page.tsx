"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { generateQuiz } from "@/lib/api";
import { QuizConfigForm } from "@/components/quiz/QuizConfigForm";

function QuizGenerateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultDocumentId = searchParams.get("document_id") ?? undefined;

  const mutation = useMutation({
    mutationFn: (config: {
      documentId: string;
      nQuestions: number;
      quizTypes: string[];
    }) =>
      generateQuiz({
        document_id: config.documentId,
        n_questions: config.nQuestions,
        quiz_types: config.quizTypes,
      }),
    onSuccess: (quiz) => {
      router.push(`/quiz/${quiz.id}`);
    },
  });

  return (
    <>
      <QuizConfigForm
        defaultDocumentId={defaultDocumentId}
        onSubmit={(config) => mutation.mutate(config)}
        isPending={mutation.isPending}
      />

      {mutation.isError && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {mutation.error.message}
        </p>
      )}
    </>
  );
}

export default function QuizGeneratePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">퀴즈 생성</h1>
      <p className="text-sm text-gray-500">
        업로드한 문서의 ID를 입력하고, 원하는 문제 수와 유형을 선택하세요.
      </p>

      <Suspense fallback={<p className="text-sm text-gray-500">로딩 중...</p>}>
        <QuizGenerateContent />
      </Suspense>
    </div>
  );
}
