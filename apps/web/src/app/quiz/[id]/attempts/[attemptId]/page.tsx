"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenCheck,
  ChevronLeft,
  CheckCircle2,
  History,
  Target,
  Trophy,
  XCircle,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { getAttemptDetail } from "@/lib/api";
import { ResultCard, type ResultCardData } from "@/components/quiz/ResultCard";
import { cn, formatDate } from "@/lib/utils";
import type { AttemptDetail, AttemptItemResult } from "@/types/api";

export default function AttemptDetailPage() {
  const { id: quizId, attemptId } = useParams<{ id: string; attemptId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["attempt-detail", quizId, attemptId],
    queryFn: () => getAttemptDetail(quizId, attemptId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <BookOpenCheck className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-slate-400">결과를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">결과를 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {error instanceof Error ? error.message : "존재하지 않거나 삭제된 풀이 기록입니다."}
        </p>
        <Link
          href={`/quiz/${quizId}`}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
        >
          퀴즈로 돌아가기
        </Link>
      </div>
    );
  }

  return <AttemptDetailView data={data} quizId={quizId} />;
}

function AttemptDetailView({ data, quizId }: { data: AttemptDetail; quizId: string }) {
  const [showCorrect, setShowCorrect] = useState(false);
  const [showIncorrect, setShowIncorrect] = useState(true);

  const percentage = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
  const correctResults = data.results.filter((r) => r.is_correct);
  const incorrectResults = data.results.filter((r) => !r.is_correct);

  function toCardData(r: AttemptItemResult, globalIndex: number) {
    const cardData: ResultCardData = {
      quiz_item_id: r.quiz_item_id,
      question: r.question,
      user_answer: r.user_answer,
      correct_answer: r.correct_answer,
      is_correct: r.is_correct,
      explanation: r.explanation,
      grading_method: r.grading_method,
      concept_tags: r.concept_tags,
      difficulty: r.difficulty,
      quiz_type: r.quiz_type,
      options: r.options,
    };
    return <ResultCard key={r.quiz_item_id} data={cardData} index={globalIndex + 1} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20">
      {/* Breadcrumb navigation */}
      <div className="flex flex-col gap-1">
        <Link
          href={`/quiz/${quizId}`}
          className="group mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-indigo-600"
        >
          <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
          퀴즈로 돌아가기
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {data.quiz_title}
        </h1>
        <p className="text-slate-500 font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-500" />
          {data.attempt_number}회차 풀이 — {formatDate(data.created_at)}
        </p>
      </div>

      {/* Score summary card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">
            Attempt #{data.attempt_number} Results
          </h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-7xl font-black tracking-tighter text-white">{data.score}</span>
            <span className="text-2xl font-bold text-slate-500">/ {data.total}</span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex h-2 w-48 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-sm font-bold text-slate-400">{percentage}% Accuracy</p>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]" />
      </div>

      {/* Per-item results */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-1 text-slate-800">
          <Target className="h-5 w-5 text-indigo-600" />
          <h3 className="text-xl font-bold tracking-tight">상세 결과 분석</h3>
        </div>

        {incorrectResults.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowIncorrect((p) => !p)}
              className="mb-4 flex w-full items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-inset ring-red-200/50 transition-all hover:bg-red-100"
            >
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                틀린 문제 ({incorrectResults.length})
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showIncorrect && "rotate-180")} />
            </button>
            {showIncorrect && (
              <div className="grid grid-cols-1 gap-4">
                {incorrectResults.map((r) => toCardData(r, data.results.indexOf(r)))}
              </div>
            )}
          </div>
        )}

        {correctResults.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCorrect((p) => !p)}
              className="mb-4 flex w-full items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200/50 transition-all hover:bg-emerald-100"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                맞은 문제 ({correctResults.length})
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showCorrect && "rotate-180")} />
            </button>
            {showCorrect && (
              <div className="grid grid-cols-1 gap-4">
                {correctResults.map((r) => toCardData(r, data.results.indexOf(r)))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-indigo-600 py-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]"
        >
          다시 풀기
        </Link>
        <Link
          href="/wrong-notes"
          className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-white border border-slate-200 py-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
        >
          오답노트 보기
        </Link>
      </div>
    </div>
  );
}
