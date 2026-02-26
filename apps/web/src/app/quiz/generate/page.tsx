"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { QuizConfigForm } from "@/components/quiz/QuizConfigForm";
import { useQuizGenerateStream } from "@/hooks/useQuizGenerateStream";

function QuizGenerateContent() {
  const searchParams = useSearchParams();
  const defaultDocumentId = searchParams.get("document_id") ?? undefined;
  const defaultFocusConcept = searchParams.get("focus_concept") ?? undefined;

  const { state, startGeneration, cancel } = useQuizGenerateStream();
  const isStreaming = state.status === "streaming";

  return (
    <div className="space-y-6">
      <QuizConfigForm
        defaultDocumentId={defaultDocumentId}
        defaultFocusConcept={defaultFocusConcept}
        onSubmit={(config) =>
          startGeneration({
            document_id: config.documentId,
            chunk_ids: config.chunkIds?.length ? config.chunkIds : null,
            n_questions: config.nQuestions,
            quiz_types: config.quizTypes,
            title: config.title || undefined,
            focus_concepts: config.focusConcepts,
          })
        }
        isPending={isStreaming}
        onCancel={isStreaming ? cancel : undefined}
      />

      {isStreaming && state.progress && (
        <div className="rounded-[2rem] border border-indigo-100 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-6 shadow-sm animate-in fade-in duration-500">
          <div className="mb-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{state.progress.message}</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-inset ring-indigo-200/50 dark:ring-indigo-800/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700 ease-out"
              style={{ width: `${Math.round((state.progress.current / state.progress.total) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-bold text-indigo-500 dark:text-indigo-400">
            <span>{state.progress.step === "saving" ? "저장 중" : "문서 분석 중"}</span>
            <span>{state.progress.current} / {state.progress.total}</span>
          </div>
        </div>
      )}

      {state.status === "error" && state.errorMessage && (
        <div className="flex items-center gap-3 rounded-[2rem] border border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-sm font-bold text-red-600 dark:text-red-400 shadow-sm animate-in shake duration-500">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-card text-red-600 dark:text-red-400 shadow-sm">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p>{state.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

export default function QuizGeneratePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-20 pt-8 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter text-text-primary">
          AI 퀴즈 생성
        </h1>
        <p className="text-lg text-text-secondary font-medium tracking-tight">
          문서를 분석하여 나에게 꼭 맞는 맞춤형 퀴즈를 생성합니다.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-[32rem] w-full animate-pulse rounded-3xl bg-surface-alt border border-border-default" />
        }
      >
        <QuizGenerateContent />
      </Suspense>

      <div className="bento-card bg-indigo-600 p-10 text-white shadow-xl shadow-indigo-200 dark:shadow-none border-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-200">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Generation Tips</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight">더 정확한 퀴즈를 만들고 싶나요?</h3>
            <p className="max-w-xl text-base font-medium text-indigo-100/90 leading-relaxed">
              다양한 문제 유형을 섞어서 선택하면 AI가 본문의 내용을 더 다각도로 분석하여 고차원적인 문항을 생성할 확률이 높아집니다.
            </p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-white backdrop-blur-md shadow-inner">
            <Sparkles className="h-10 w-10 text-indigo-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
