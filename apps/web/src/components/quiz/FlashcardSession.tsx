"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  ListOrdered,
  CheckSquare,
  PenTool,
  HelpCircle,
  Shuffle,
  Sparkles,
  Tag,
  Trophy,
  RotateCcw,
} from "lucide-react";
import type { FlashcardItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { useFlashcardShortcuts } from "@/hooks/useFlashcardShortcuts";
import { ShortcutHelpPanel } from "@/components/common/ShortcutHelpPanel";

interface FlashcardSessionProps {
  items: FlashcardItem[];
  quizTitle: string;
  onExit: () => void;
}

type SessionPhase = "studying" | "summary";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof ListOrdered; color: string; bg: string }
> = {
  mcq: { label: "객관식", icon: ListOrdered, color: "text-blue-500", bg: "bg-blue-50" },
  true_false: { label: "O/X", icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-50" },
  fill_blank: { label: "빈칸 채우기", icon: PenTool, color: "text-purple-500", bg: "bg-purple-50" },
  short_answer: { label: "단답형", icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-50" },
};

const DIFFICULTY_LABELS = ["", "쉬움", "보통", "어려움"];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardSession({ items, quizTitle, onExit }: FlashcardSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [phase, setPhase] = useState<SessionPhase>("studying");
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledItems, setShuffledItems] = useState<FlashcardItem[]>([]);

  const displayItems = isShuffled ? shuffledItems : items;
  const currentItem = displayItems[currentIndex] as FlashcardItem | undefined;
  const progressPercent = displayItems.length > 0
    ? Math.round(((currentIndex + 1) / displayItems.length) * 100)
    : 0;

  const handleToggleShuffle = useCallback(() => {
    setIsShuffled((prev) => {
      if (!prev) {
        setShuffledItems(shuffleArray(items));
      }
      return !prev;
    });
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [items]);

  const goNext = useCallback(() => {
    if (isAnimatingOut) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= displayItems.length) {
      setPhase("summary");
      return;
    }
    setIsAnimatingOut(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsFlipped(false);
      setIsAnimatingOut(false);
    }, 300);
  }, [currentIndex, displayItems.length, isAnimatingOut]);

  const goPrev = useCallback(() => {
    if (isAnimatingOut || currentIndex === 0) return;
    setIsAnimatingOut(true);
    setTimeout(() => {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setIsAnimatingOut(false);
    }, 300);
  }, [currentIndex, isAnimatingOut]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  useFlashcardShortcuts({
    isFlipped,
    onFlip: handleFlip,
    onNext: goNext,
    onPrev: goPrev,
    enabled: phase === "studying",
  });

  function handleRestart() {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsAnimatingOut(false);
    setPhase("studying");
    if (isShuffled) {
      setShuffledItems(shuffleArray(items));
    }
  }

  // --- Summary Phase ---
  if (phase === "summary") {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">
              Study Complete
            </h2>
            <p className="mt-3 text-lg font-bold text-slate-300">
              {displayItems.length}개 카드 학습 완료
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {quizTitle}
            </p>
          </div>

          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]" />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onExit}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-card px-6 py-3.5 text-sm font-bold text-text-secondary shadow-sm ring-1 ring-inset ring-border-default transition-all hover:bg-surface-alt active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </button>
          <button
            onClick={handleRestart}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-card px-6 py-3.5 text-sm font-bold text-text-secondary shadow-sm ring-1 ring-inset ring-border-default transition-all hover:bg-surface-alt active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            다시 보기
          </button>
          <Link
            href="/quiz/generate"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            새로운 퀴즈 생성
          </Link>
        </div>
      </div>
    );
  }

  if (!currentItem) return null;

  const typeConfig = TYPE_CONFIG[currentItem.quiz_type] ?? TYPE_CONFIG.mcq;
  const TypeIcon = typeConfig.icon;

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

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleShuffle}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
              isShuffled
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700"
                : "bg-surface-alt text-text-tertiary hover:text-text-secondary",
            )}
            title={isShuffled ? "순서대로 보기" : "셔플"}
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <span className="rounded-full bg-surface-alt px-4 py-1.5 text-xs font-black uppercase tracking-widest text-text-secondary ring-1 ring-inset ring-border-default/50">
            {currentIndex + 1} / {displayItems.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
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
            <div className="flex items-center gap-2">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", typeConfig.bg)}>
                <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
              </div>
              <span className="text-xs font-bold text-text-tertiary">{typeConfig.label}</span>
              {currentItem.difficulty > 0 && (
                <span className="rounded-lg bg-surface-alt px-2 py-0.5 text-[10px] font-bold text-text-tertiary ring-1 ring-inset ring-border-default/50">
                  {DIFFICULTY_LABELS[currentItem.difficulty] ?? `Lv.${currentItem.difficulty}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentItem.concept_tags.map((tag) => (
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
            {currentItem.question}
          </p>

          {/* MCQ options on front */}
          {currentItem.quiz_type === "mcq" && currentItem.options && (
            <div className="mt-6 space-y-2">
              {Object.entries(currentItem.options).map(([key, text]) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset transition-all",
                    isFlipped && key === currentItem.correct_answer
                      ? "bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700 text-emerald-700 dark:text-emerald-400"
                      : "bg-surface-alt ring-border-default/50 text-text-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                      isFlipped && key === currentItem.correct_answer
                        ? "bg-emerald-500 text-white"
                        : "bg-surface-card text-text-tertiary ring-1 ring-inset ring-border-default",
                    )}
                  >
                    {key}
                  </span>
                  <span className="text-sm font-medium">{text}</span>
                  {isFlipped && key === currentItem.correct_answer && (
                    <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Answer reveal section (non-MCQ) */}
        {currentItem.quiz_type !== "mcq" && (
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300",
              isFlipped ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="border-t border-border-default p-8 pt-6">
                <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 p-4 ring-1 ring-inset ring-emerald-100/50 dark:ring-emerald-800/30">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 dark:text-emerald-500">
                    Correct Answer
                  </p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {currentItem.quiz_type === "true_false"
                      ? currentItem.correct_answer === "O" ? "O (참)" : "X (거짓)"
                      : currentItem.correct_answer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Explanation (shown when flipped, for all types) */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300",
            isFlipped ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className={cn(
              "px-8 pb-6",
              currentItem.quiz_type === "mcq" ? "pt-2 border-t border-border-default" : "pt-0",
            )}>
              {currentItem.explanation && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-surface-alt p-4 text-text-secondary ring-1 ring-inset ring-border-default/30">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                  <p className="text-xs font-medium leading-relaxed">
                    <span className="font-bold text-text-primary">해설: </span>
                    {currentItem.explanation}
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
              onClick={handleFlip}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Eye className="h-4 w-4" />
              정답 보기
              <kbd className="ml-1 hidden rounded bg-indigo-500 px-1.5 py-0.5 text-[9px] font-mono font-bold text-indigo-200 sm:inline-block">
                Space
              </kbd>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-card py-3.5 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt disabled:opacity-30 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                이전
                <kbd className="ml-1 hidden rounded bg-surface-alt px-1.5 py-0.5 text-[9px] font-mono font-bold text-text-tertiary sm:inline-block">
                  ←
                </kbd>
              </button>
              <button
                onClick={handleFlip}
                className="flex items-center justify-center rounded-xl border border-border-default bg-surface-card px-4 py-3.5 text-text-tertiary transition-all hover:bg-surface-alt active:scale-95"
                title="정답 접기"
              >
                <EyeOff className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
              >
                {currentIndex === displayItems.length - 1 ? "완료" : "다음"}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <kbd className="ml-1 hidden rounded bg-indigo-500 px-1.5 py-0.5 text-[9px] font-mono font-bold text-indigo-200 sm:inline-block">
                  →
                </kbd>
              </button>
            </div>
          )}
        </div>
      </div>

      <ShortcutHelpPanel
        shortcuts={[
          { keys: ["Space"], description: "정답 보기 / 접기" },
          { keys: ["→", "↓"], description: "다음 카드" },
          { keys: ["←", "↑"], description: "이전 카드" },
        ]}
      />
    </div>
  );
}
