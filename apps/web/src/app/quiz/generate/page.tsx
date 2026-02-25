"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, AlertCircle } from "lucide-react";
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
      title: string;
      chunkIds?: string[];
    }) =>
      generateQuiz({
        document_id: config.documentId,
        chunk_ids: config.chunkIds?.length ? config.chunkIds : null,
        n_questions: config.nQuestions,
        quiz_types: config.quizTypes,
        title: config.title || undefined,
      }),
    onSuccess: (quiz) => {
      router.push(`/quiz/${quiz.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <QuizConfigForm
        defaultDocumentId={defaultDocumentId}
        onSubmit={(config) => mutation.mutate(config)}
        isPending={mutation.isPending}
      />

      {mutation.isError && (
        <div className="flex items-center gap-3 rounded-[2rem] border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-600 shadow-sm animate-in shake duration-500">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p>{mutation.error.message}</p>
        </div>
      )}
    </div>
  );
}

export default function QuizGeneratePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          AI 퀴즈 생성
        </h1>
        <p className="text-slate-500 font-medium">
          문서를 분석하여 나에게 꼭 맞는 맞춤형 퀴즈를 생성합니다.
        </p>
      </div>

      <Suspense 
        fallback={
          <div className="h-96 w-full animate-pulse rounded-[2rem] bg-slate-100" />
        }
      >
        <QuizGenerateContent />
      </Suspense>

      <div className="rounded-[2rem] bg-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-black uppercase tracking-[0.2em]">Quiz Generation Tips</span>
            </div>
            <h3 className="text-xl font-bold">더 정확한 퀴즈를 만들고 싶나요?</h3>
            <p className="max-w-md text-sm font-medium text-slate-400 leading-relaxed">
              다양한 문제 유형을 섞어서 선택하면 AI가 본문의 내용을 더 다각도로 분석하여 고차원적인 문항을 생성할 확률이 높아집니다.
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md">
            <Sparkles className="h-8 w-8 text-indigo-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
