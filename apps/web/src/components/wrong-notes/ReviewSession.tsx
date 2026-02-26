"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Info,
  Tag,
  ArrowLeft,
  Trophy,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { reviewWrongNote } from "@/lib/api";
import type { WrongNote } from "@/types/api";
import { cn } from "@/lib/utils";
import { useReviewShortcuts } from "@/hooks/useReviewShortcuts";
import { ShortcutHelpPanel } from "@/components/common/ShortcutHelpPanel";
import { MasteryProgress } from "./MasteryProgress";

interface ReviewSessionProps {
  notes: WrongNote[];
  onExit: () => void;
  backLabel?: string;
}

interface ReviewResult {
  noteId: string;
  quality: 1 | 3 | 5;
  isNowMastered: boolean;
}

type SessionPhase = "reviewing" | "summary";

export function ReviewSession({ notes, onExit, backLabel }: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [phase, setPhase] = useState<SessionPhase>("reviewing");

  const currentNote = notes[currentIndex] as WrongNote | undefined;

  const mutation = useMutation({
    mutationFn: ({ noteId, quality }: { noteId: string; quality: 1 | 3 | 5 }) =>
      reviewWrongNote(noteId, quality),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleReview(quality: 1 | 3 | 5) {
    if (!currentNote || mutation.isPending) return;

    mutation.mutate(
      { noteId: currentNote.id, quality },
      {
        onSuccess: (updatedNote) => {
          setResults((prev) => [
            ...prev,
            {
              noteId: currentNote.id,
              quality,
              isNowMastered: updatedNote.is_mastered,
            },
          ]);

          setIsAnimatingOut(true);
          setTimeout(() => {
            const nextIndex = currentIndex + 1;
            if (nextIndex >= notes.length) {
              setPhase("summary");
            } else {
              setCurrentIndex(nextIndex);
              setIsFlipped(false);
            }
            setIsAnimatingOut(false);
            mutation.reset();
          }, 300);
        },
      },
    );
  }

  useReviewShortcuts({
    isFlipped,
    onFlip: () => setIsFlipped(true),
    onRate: handleReview,
    enabled: phase === "reviewing",
    isPending: mutation.isPending,
  });

  if (phase === "summary") {
    const correctCount = results.filter((r) => r.quality >= 3).length;
    const incorrectCount = results.length - correctCount;
    const newlyMastered = results.filter((r) => r.isNowMastered).length;

    return (
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">
              Review Complete
            </h2>
            <p className="mt-3 text-lg font-bold text-slate-300">
              {results.length}개 문항 복습 완료
            </p>

            <div className="mt-8 flex gap-6">
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <span className="text-2xl font-black text-white">{correctCount}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Correct
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                  <XCircle className="h-6 w-6" />
                </div>
                <span className="text-2xl font-black text-white">{incorrectCount}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Incorrect
                </span>
              </div>
            </div>

            {newlyMastered > 0 && (
              <div className="mt-8 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                {newlyMastered}개 문항 마스터리 달성!
              </div>
            )}
          </div>

          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]" />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onExit}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-surface-card px-6 py-3.5 text-sm font-bold text-text-secondary shadow-sm ring-1 ring-inset ring-border-default transition-all hover:bg-surface-alt active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel ?? "오답노트로 돌아가기"}
          </button>
          <Link
            href="/quiz/generate"
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            새로운 퀴즈 생성
          </Link>
        </div>
      </div>
    );
  }

  if (!currentNote) return null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          나가기
        </button>
        <span className="rounded-full bg-surface-alt px-4 py-1.5 text-xs font-black uppercase tracking-widest text-text-secondary ring-1 ring-inset ring-border-default/50">
          {currentIndex + 1} / {notes.length}
        </span>
      </div>

      {/* Card */}
      <div
        className={cn(
          "overflow-hidden rounded-[2rem] border border-border-default bg-surface-card shadow-sm transition-all duration-300",
          isAnimatingOut ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100",
        )}
      >
        {/* Question (always visible) */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <MasteryProgress
              consecutiveCorrect={currentNote.consecutive_correct}
              isMastered={currentNote.is_mastered}
              easeFactor={currentNote.ease_factor}
            />
            <div className="flex flex-wrap gap-1.5">
              {currentNote.concept_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-100 dark:ring-indigo-800"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-lg font-bold leading-relaxed text-text-primary">
            {currentNote.question}
          </p>
        </div>

        {/* Answer reveal section */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300",
            isFlipped ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border-default p-8 pt-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-red-50/50 dark:bg-red-900/10 p-3 ring-1 ring-inset ring-red-100/50 dark:ring-red-800/30">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-400 dark:text-red-500">
                    Your Answer
                  </p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    {currentNote.user_answer || "(No Answer)"}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 p-3 ring-1 ring-inset ring-emerald-100/50 dark:ring-emerald-800/30">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 dark:text-emerald-500">
                    Correct Answer
                  </p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {currentNote.correct_answer}
                  </p>
                </div>
              </div>

              {currentNote.wrong_reason && (
                <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-surface-alt p-4 text-text-secondary ring-1 ring-inset ring-border-default/30">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                  <p className="text-xs font-medium leading-relaxed">
                    <span className="font-bold text-text-primary">분석: </span>
                    {currentNote.wrong_reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-8 pt-0">
          {!isFlipped ? (
            <button
              onClick={() => setIsFlipped(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Eye className="h-4 w-4" />
              정답 보기
              <kbd className="hidden sm:inline-block ml-1 rounded bg-indigo-500 px-1.5 py-0.5 text-[9px] font-mono font-bold text-indigo-200">Space</kbd>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleReview(1)}
                disabled={mutation.isPending}
                className="group flex flex-1 flex-col items-center gap-1 rounded-xl border border-border-default bg-surface-card px-3 py-3 text-sm font-bold text-text-secondary transition-all hover:border-red-200 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 active:scale-95"
              >
                <XCircle className="h-4 w-4 text-red-400 transition-transform group-hover:scale-110" />
                <span className="text-xs">모르겠어요</span>
                <kbd className="hidden sm:inline-block rounded bg-surface-alt px-1.5 py-0.5 text-[9px] font-mono font-bold text-text-tertiary">1</kbd>
              </button>
              <button
                onClick={() => handleReview(3)}
                disabled={mutation.isPending}
                className="group flex flex-1 flex-col items-center gap-1 rounded-xl border border-border-default bg-surface-card px-3 py-3 text-sm font-bold text-text-secondary transition-all hover:border-amber-200 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50 active:scale-95"
              >
                <AlertCircle className="h-4 w-4 text-amber-400 transition-transform group-hover:scale-110" />
                <span className="text-xs">어려웠어요</span>
                <kbd className="hidden sm:inline-block rounded bg-surface-alt px-1.5 py-0.5 text-[9px] font-mono font-bold text-text-tertiary">3</kbd>
              </button>
              <button
                onClick={() => handleReview(5)}
                disabled={mutation.isPending}
                className="group flex flex-1 flex-col items-center gap-1 rounded-xl border border-border-default bg-surface-card px-3 py-3 text-sm font-bold text-text-secondary transition-all hover:border-emerald-200 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 active:scale-95"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 transition-transform group-hover:scale-110" />
                <span className="text-xs">쉬웠어요</span>
                <kbd className="hidden sm:inline-block rounded bg-surface-alt px-1.5 py-0.5 text-[9px] font-mono font-bold text-text-tertiary">5</kbd>
              </button>
            </div>
          )}
        </div>

      </div>

      <ShortcutHelpPanel
        shortcuts={[
          { keys: ["Space"], description: "정답 보기" },
          { keys: ["1"], description: "모르겠어요" },
          { keys: ["3"], description: "어려웠어요" },
          { keys: ["5"], description: "쉬웠어요" },
        ]}
      />
    </div>
  );
}
