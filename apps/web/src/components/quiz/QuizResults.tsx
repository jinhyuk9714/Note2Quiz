"use client";

import { useState, useEffect, useMemo } from "react";
import type { SubmitResult, QuizItem as QuizItemType, AnswerResult } from "@/types/api";
import { cn, formatElapsedTime } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, Trophy, Target, Brain, Sparkles, ChevronDown, Timer } from "lucide-react";

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

  function renderResultCard(r: AnswerResult) {
    const item = items.find((q) => q.id === r.quiz_item_id);
    const globalIndex = result.results.indexOf(r);
    return (
      <div
        key={r.quiz_item_id}
        className={cn(
          "overflow-hidden rounded-[2rem] border p-6 transition-all",
          r.is_correct
            ? "border-emerald-100 bg-emerald-50/30"
            : "border-red-100 bg-red-50/30",
        )}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            r.is_correct ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
          )}>
            {r.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 leading-relaxed">
              <span className="mr-2 text-slate-400">Q{globalIndex + 1}.</span>
              {item?.question ?? ""}
            </p>

            {/* Concept tags + difficulty */}
            {item && (item.concept_tags.length > 0 || item.difficulty > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.concept_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50"
                  >
                    {tag}
                  </span>
                ))}
                {item.difficulty > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-200/50">
                    {"★".repeat(item.difficulty)}
                    {"☆".repeat(Math.max(0, 3 - item.difficulty))}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/50 p-3 ring-1 ring-inset ring-slate-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">My Answer</p>
                  {r.grading_method === "semantic" && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-inset ring-violet-200">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI 채점
                    </span>
                  )}
                </div>
                <p className={cn("text-sm font-bold", r.is_correct ? "text-emerald-600" : "text-red-600")}>
                  {r.user_answer || "(No Answer)"}
                </p>
              </div>
              {!r.is_correct && (
                <div className="rounded-xl bg-emerald-500/5 p-3 ring-1 ring-inset ring-emerald-500/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60 mb-1">Correct Answer</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {r.correct_answer}
                  </p>
                </div>
              )}
            </div>

            {r.explanation && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100/50 p-4 ring-1 ring-inset ring-slate-200/30">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="text-xs font-medium leading-relaxed text-slate-500">
                  <span className="font-bold text-slate-700">해설: </span>
                  {r.explanation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Score summary */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10">
            {percentage === 100 ? (
              <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
            ) : (
              <Trophy className="h-8 w-8" />
            )}
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">
            Quiz Completed{result.attempt_number > 1 && ` — Attempt #${result.attempt_number}`}
          </h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-7xl font-black tracking-tighter text-white">{result.score}</span>
            <span className="text-2xl font-bold text-slate-500">/ {result.total}</span>
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

          {percentage === 100 && (
            <p className="mt-4 text-sm font-bold text-yellow-400">
              만점! 완벽하게 풀었습니다!
            </p>
          )}

          {elapsedMs != null && (
            <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-400">
              <Timer className="h-4 w-4" />
              소요시간: {formatElapsedTime(elapsedMs)}
            </div>
          )}

          {result.wrong_notes_created > 0 && (
            <div className="mt-8 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 ring-1 ring-inset ring-amber-500/20">
              <Brain className="h-3.5 w-3.5" />
              {result.wrong_notes_created}개의 오답노트가 생성되었습니다
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]" />
      </div>

      {/* Type breakdown */}
      {typeBreakdown.length > 1 && (
        <div className="flex flex-wrap justify-center gap-3">
          {typeBreakdown.map((tb) => (
            <div
              key={tb.label}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold shadow-sm ring-1 ring-inset ring-slate-200/50"
            >
              <span className="text-slate-500">{tb.label}</span>
              <span className="text-indigo-600">{tb.correct}/{tb.total}</span>
            </div>
          ))}
        </div>
      )}

      {/* Detailed results - grouped by correct/incorrect */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-1 text-slate-800">
          <Target className="h-5 w-5 text-indigo-600" />
          <h3 className="text-xl font-bold tracking-tight">상세 결과 분석</h3>
        </div>

        {/* Incorrect section - expanded by default */}
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
                {incorrectResults.map((r) => renderResultCard(r))}
              </div>
            )}
          </div>
        )}

        {/* Correct section - collapsed by default */}
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
                {correctResults.map((r) => renderResultCard(r))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
