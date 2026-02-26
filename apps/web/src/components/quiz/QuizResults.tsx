"use client";

import { useState, useEffect, useMemo } from "react";
import type { SubmitResult, QuizItem as QuizItemType, AnswerResult } from "@/types/api";
import { cn, formatElapsedTime } from "@/lib/utils";
import { CheckCircle2, XCircle, Trophy, Target, Brain, Sparkles, ChevronDown, Timer } from "lucide-react";
import { ResultCard, type ResultCardData } from "@/components/quiz/ResultCard";

const TYPE_LABELS: Record<string, string> = {
  mcq: "객관식",
  true_false: "O/X",
  fill_blank: "빈칸 채우기",
  short_answer: "단답형",
};

interface QuizResultsProps {
  result: SubmitResult;
  items: QuizItemType[];
  elapsedMs?: number | null;
}

export function QuizResults({ result, items, elapsedMs }: QuizResultsProps) {
  const percentage = Math.round((result.score / result.total) * 100);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showIncorrect, setShowIncorrect] = useState(true);

  // Confetti for perfect score
  useEffect(() => {
    if (percentage === 100) {
      void import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        void confetti({ particleCount: 80, spread: 70, origin: { x: 0.2, y: 0.6 } });
        void confetti({ particleCount: 80, spread: 70, origin: { x: 0.8, y: 0.6 } });
      });
    }
  }, [percentage]);

  // Type breakdown
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; label: string }>();
    for (const r of result.results) {
      const item = items.find((q) => q.id === r.quiz_item_id);
      const type = item?.quiz_type ?? "unknown";
      const label = TYPE_LABELS[type] ?? type;
      const existing = map.get(type) ?? { correct: 0, total: 0, label };
      existing.total += 1;
      if (r.is_correct) existing.correct += 1;
      map.set(type, existing);
    }
    return Array.from(map.values());
  }, [result.results, items]);

  const correctResults = result.results.filter((r) => r.is_correct);
  const incorrectResults = result.results.filter((r) => !r.is_correct);

  function toResultCard(r: AnswerResult) {
    const item = items.find((q) => q.id === r.quiz_item_id);
    const globalIndex = result.results.indexOf(r);
    const data: ResultCardData = {
      quiz_item_id: r.quiz_item_id,
      question: item?.question ?? "",
      user_answer: r.user_answer,
      correct_answer: r.correct_answer,
      is_correct: r.is_correct,
      explanation: r.explanation,
      grading_method: r.grading_method,
      concept_tags: item?.concept_tags ?? [],
      difficulty: item?.difficulty ?? 0,
      quiz_type: item?.quiz_type,
      options: item?.options,
    };
    return <ResultCard key={r.quiz_item_id} data={data} index={globalIndex + 1} />;
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Score summary */}
      <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-12 text-white shadow-2xl shadow-indigo-900/20">
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10 shadow-inner">
            {percentage === 100 ? (
              <Sparkles className="h-10 w-10 text-yellow-400 animate-pulse" />
            ) : (
              <Trophy className="h-10 w-10" />
            )}
          </div>
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">
            Quiz Completed{result.attempt_number > 1 && ` — Attempt #${result.attempt_number}`}
          </h2>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-8xl font-black tracking-tighter text-white drop-shadow-md">{result.score}</span>
            <span className="text-3xl font-bold text-slate-500">/ {result.total}</span>
          </div>
          <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">{percentage}% Accuracy</p>
          </div>

          {percentage === 100 && (
            <p className="mt-6 text-sm font-black tracking-wide text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-xl ring-1 ring-yellow-400/20">
              만점! 완벽하게 풀었습니다!
            </p>
          )}

          {elapsedMs != null && (
            <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
              <Timer className="h-4 w-4 text-indigo-400" />
              Time: {formatElapsedTime(elapsedMs)}
            </div>
          )}

          {(result.wrong_notes_created > 0 || result.wrong_notes_updated > 0) && (
            <div className="mt-10 space-y-3 w-full max-w-sm">
              {result.wrong_notes_created > 0 && (
                <div className="flex items-center justify-center gap-3 rounded-2xl bg-amber-500/10 px-5 py-3 text-xs font-black text-amber-400 ring-1 ring-inset ring-amber-500/20">
                  <Brain className="h-4 w-4" />
                  {result.wrong_notes_created}개의 오답노트가 생성되었습니다
                </div>
              )}
              {result.wrong_notes_updated > 0 && (
                <div className="flex items-center justify-center gap-3 rounded-2xl bg-orange-500/10 px-5 py-3 text-xs font-black text-orange-400 ring-1 ring-inset ring-orange-500/20">
                  <Brain className="h-4 w-4" />
                  {result.wrong_notes_updated}개의 기존 오답노트가 갱신되었습니다
                </div>
              )}
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />
      </div>

      {/* Type breakdown */}
      {typeBreakdown.length > 1 && (
        <div className="flex flex-wrap justify-center gap-4">
          {typeBreakdown.map((tb) => (
            <div
              key={tb.label}
              className="flex items-center gap-3 rounded-2xl bg-surface-card px-5 py-3 text-sm font-bold shadow-sm ring-1 ring-inset ring-border-default"
            >
              <span className="text-text-secondary">{tb.label}</span>
              <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">{tb.correct}/{tb.total}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detailed results - grouped by correct/incorrect */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 px-2 text-text-primary">
          <Target className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-2xl font-black tracking-tight">상세 결과 분석</h3>
        </div>

        {/* Incorrect section - expanded by default */}
        {incorrectResults.length > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowIncorrect((p) => !p)}
              className="group flex w-full items-center justify-between rounded-2xl bg-red-50 dark:bg-red-900/20 px-6 py-4 text-sm font-black text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-200/50 transition-all hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5" />
                틀린 문제 ({incorrectResults.length})
              </div>
              <ChevronDown className={cn("h-5 w-5 transition-transform group-hover:text-red-800 dark:group-hover:text-red-300", showIncorrect && "rotate-180")} />
            </button>
            {showIncorrect && (
              <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-top-2 duration-300">
                {incorrectResults.map((r) => toResultCard(r))}
              </div>
            )}
          </div>
        )}

        {/* Correct section - collapsed by default */}
        {correctResults.length > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowCorrect((p) => !p)}
              className="group flex w-full items-center justify-between rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 text-sm font-black text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-200/50 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                맞은 문제 ({correctResults.length})
              </div>
              <ChevronDown className={cn("h-5 w-5 transition-transform group-hover:text-emerald-800 dark:group-hover:text-emerald-300", showCorrect && "rotate-180")} />
            </button>
            {showCorrect && (
              <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-top-2 duration-300">
                {correctResults.map((r) => toResultCard(r))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
