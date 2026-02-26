"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CheckCircle2, BookOpenCheck, Sparkles, AlertCircle, RotateCcw, History, RefreshCw, X, Download, Pencil, Link2 } from "lucide-react";
import { toast } from "sonner";
import { getQuiz, submitQuiz, listQuizAttempts } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { QuizItem } from "@/components/quiz/QuizItem";
import { QuestionNavPanel } from "@/components/quiz/QuestionNavPanel";
import { QuizResults } from "@/components/quiz/QuizResults";
import { QuizTimer } from "@/components/quiz/QuizTimer";
import { loadDraftSnapshot, useQuizDraft, useDraftBanner } from "@/hooks/useQuizDraft";
import { useQuizShortcuts } from "@/hooks/useQuizShortcuts";
import { ShortcutHelpPanel } from "@/components/common/ShortcutHelpPanel";
import { ShareDialog } from "@/components/quiz/ShareDialog";
import type { Quiz, SubmitResult } from "@/types/api";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";

type Phase = "taking" | "submitting" | "results";

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();

  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => getQuiz(id),
  });

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

  return <QuizTaker quiz={quiz} />;
}

/** Inner component — mounted only after quiz data is available, so useState initializers can read the draft. */
function QuizTaker({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const itemIds = quiz.items.map((i) => i.id);
  const [snapshot] = useState(() => loadDraftSnapshot(quiz.id, itemIds));

  const [answers, setAnswers] = useState<Record<string, string>>(
    () => snapshot?.answers ?? {},
  );
  const [skippedIds, setSkippedIds] = useState<Set<string>>(
    () => snapshot?.skippedIds ?? new Set(),
  );
  const [phase, setPhase] = useState<Phase>("taking");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [retryItemIds, setRetryItemIds] = useState<Set<string> | null>(null);
  const [elapsedSec, setElapsedSec] = useState(
    () => snapshot?.elapsedSec ?? 0,
  );
  const [finalElapsedMs, setFinalElapsedMs] = useState<number | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [csvExporting, setCsvExporting] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { saveDraft, clearDraft } = useQuizDraft(quiz.id, itemIds);
  const { wasRestored, dismissRestored } = useDraftBanner(snapshot !== null);

  const { data: attempts } = useQuery({
    queryKey: ["quiz-attempts", quiz.id],
    queryFn: () => listQuizAttempts(quiz.id),
    enabled: phase === "results",
  });

  // Auto-save answers to localStorage on change
  useEffect(() => {
    if (phase !== "taking" || (Object.keys(answers).length === 0 && skippedIds.size === 0)) return;
    saveDraft(answers, elapsedSec, skippedIds);
  }, [answers, skippedIds, phase, saveDraft, elapsedSec]);

  // Warn before leaving with unsaved answers
  useEffect(() => {
    if (phase !== "taking" || (Object.keys(answers).length === 0 && skippedIds.size === 0)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase, answers, skippedIds]);

  // Timer: count up every second while taking
  useEffect(() => {
    if (phase !== "taking") return;
    const intervalId = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(intervalId);
  }, [phase]);

  const handleAnswer = useCallback((itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  }, []);

  const handleSkipItem = useCallback((itemId: string) => {
    setSkippedIds((prev) => new Set(prev).add(itemId));
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      submitQuiz(
        quiz.id,
        Object.entries(answers).map(([quiz_item_id, user_answer]) => ({
          quiz_item_id,
          user_answer,
        })),
      ),
    onMutate: () => {
      setFinalElapsedMs(elapsedSec * 1000);
      setPhase("submitting");
    },
    onSuccess: (data) => {
      setResult(data);
      setPhase("results");
      clearDraft();
      window.scrollTo({ top: 0, behavior: "smooth" });
      void queryClient.invalidateQueries({ queryKey: ["quiz-attempts", quiz.id] });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (err: Error) => {
      setPhase("taking");
      toast.error(err.message);
    },
  });

  function handleRetake() {
    clearDraft();
    setRetryItemIds(null);
    setAnswers({});
    setSkippedIds(new Set());
    setCurrentIndex(0);
    setResult(null);
    setElapsedSec(0);
    setFinalElapsedMs(null);
    setPhase("taking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRetakeWrongOnly() {
    if (!result) return;
    clearDraft();
    const wrongIds = new Set(
      result.results.filter((r) => !r.is_correct).map((r) => r.quiz_item_id),
    );
    setRetryItemIds(wrongIds);
    setAnswers({});
    setSkippedIds(new Set());
    setCurrentIndex(0);
    setResult(null);
    setElapsedSec(0);
    setFinalElapsedMs(null);
    setPhase("taking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSkip(itemId: string) {
    setSkippedIds((prev) => new Set(prev).add(itemId));
  }

  function handleSubmit() {
    if (answeredCount === 0) return;
    const unanswered = totalCount - answeredCount;
    if (unanswered > 0) {
      setSubmitConfirmOpen(true);
      return;
    }
    mutation.mutate();
  }

  const displayItems = retryItemIds
    ? quiz.items.filter((item) => retryItemIds.has(item.id))
    : quiz.items;

  useQuizShortcuts({
    items: displayItems,
    currentIndex,
    setCurrentIndex,
    onAnswer: handleAnswer,
    onSkip: handleSkipItem,
    onSubmit: handleSubmit,
    enabled: phase === "taking",
  });
  const answeredCount = Object.keys(answers).length;
  const totalCount = displayItems.length;
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{quiz.title}</h1>
            <Link
              href={`/quiz/${quiz.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 transition-all hover:bg-amber-50 hover:text-amber-600"
              title="편집"
            >
              <Pencil className="h-3 w-3" />
              편집
            </Link>
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600"
              title="공유"
            >
              <Link2 className="h-3 w-3" />
              공유
            </button>
          </div>
          <p className="text-slate-500 font-medium">
            {phase === "results"
              ? "퀴즈 결과 분석"
              : retryItemIds
                ? `오답 ${retryItemIds.size}문제를 다시 풀어보세요.`
                : "문제를 정독하고 정답을 선택하세요."}
          </p>
        </div>

        {phase === "taking" && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <QuizTimer
              elapsedSec={elapsedSec}
              enabled={timerEnabled}
              onToggle={() => setTimerEnabled((p) => !p)}
            />
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
          <QuizResults result={result} items={quiz.items} elapsedMs={finalElapsedMs} />

          {attempts && attempts.length > 1 && (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <History className="h-5 w-5 text-indigo-600" />
                풀이 기록
              </h3>
              <div className="space-y-2">
                {attempts.map((a) => (
                  <Link
                    key={a.attempt_id}
                    href={`/quiz/${quiz.id}/attempts/${a.attempt_id}`}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:ring-1 hover:ring-inset hover:ring-indigo-300",
                      a.attempt_id === result.attempt_id
                        ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                        : "bg-slate-50 hover:bg-indigo-50/50",
                    )}
                  >
                    <span className="text-sm font-bold text-slate-600">
                      {a.attempt_number}회차
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {a.score}/{a.total}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">
                        {formatDate(a.created_at)}
                      </span>
                      <ChevronRight className="h-3 w-3 text-slate-300" />
                    </div>
                  </Link>
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
            {result.score < result.total && (
              <button
                onClick={handleRetakeWrongOnly}
                className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-rose-500 py-5 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-600 active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" />
                오답만 다시 풀기 ({result.total - result.score}문제)
              </button>
            )}
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

          <button
            onClick={() => {
              setCsvExporting(true);
              void downloadFile(
                `/api/export/quiz/${quiz.id}/attempts/${result.attempt_id}/csv`,
                `${quiz.title}-결과.csv`,
              )
                .catch(() => {/* handled by downloadFile */})
                .finally(() => setCsvExporting(false));
            }}
            disabled={csvExporting}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700 active:scale-95 disabled:opacity-70"
          >
            {csvExporting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            결과 CSV 다운로드
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {wasRestored && phase === "taking" && (
            <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700">
              <span>이전에 작성하던 답안이 복원되었습니다.</span>
              <button
                type="button"
                onClick={dismissRestored}
                className="ml-4 flex h-6 w-6 items-center justify-center rounded-lg text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {phase === "taking" && displayItems.length > 1 && (
            <QuestionNavPanel
              items={displayItems}
              answers={answers}
              skippedIds={skippedIds}
              currentIndex={currentIndex}
              onNavigate={setCurrentIndex}
            />
          )}

          <div className="space-y-6">
            {displayItems.map((item, displayIdx) => {
              const originalIndex = quiz.items.findIndex((q) => q.id === item.id);
              return (
                <QuizItem
                  key={item.id}
                  item={item}
                  index={originalIndex}
                  value={answers[item.id] ?? ""}
                  onChange={(val) =>
                    setAnswers((prev) => ({ ...prev, [item.id]: val }))
                  }
                  disabled={phase !== "taking"}
                  onSkip={phase === "taking" ? () => handleSkip(item.id) : undefined}
                  isSkipped={skippedIds.has(item.id)}
                  isFocused={displayIdx === currentIndex && phase === "taking"}
                />
              );
            })}
          </div>

          <button
            onClick={handleSubmit}
            disabled={answeredCount === 0 || phase === "submitting"}
            className={cn(
              "group sticky bottom-6 z-20 w-full flex items-center justify-center gap-3 rounded-[2rem] py-6 text-lg font-black text-white shadow-2xl transition-all active:scale-[0.98]",
              answeredCount > 0
                ? allAnswered
                  ? "bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700"
                  : "bg-indigo-500 shadow-indigo-400/30 hover:bg-indigo-600"
                : "bg-slate-300 cursor-not-allowed opacity-80"
            )}
          >
            {phase === "submitting" ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                채점 분석 중...
              </>
            ) : allAnswered ? (
              <>
                퀴즈 제출하고 점수 확인
                <CheckCircle2 className="h-6 w-6 transition-transform group-hover:scale-125" />
              </>
            ) : (
              <>
                퀴즈 제출 ({answeredCount}/{totalCount} 답변)
                <CheckCircle2 className="h-6 w-6" />
              </>
            )}
          </button>

          <ConfirmDialog
            open={submitConfirmOpen}
            onConfirm={() => {
              setSubmitConfirmOpen(false);
              mutation.mutate();
            }}
            onCancel={() => setSubmitConfirmOpen(false)}
            title="미답변 문항 있음"
            description={`${totalCount - answeredCount}개 문항이 미답변입니다. 그래도 제출하시겠습니까?`}
            confirmLabel="제출"
            variant="default"
          />
        </div>
      )}

      {phase === "taking" && (
        <ShortcutHelpPanel
          shortcuts={[
            { keys: ["1", "~", "9"], description: "문항으로 이동" },
            { keys: ["↑", "↓"], description: "이전/다음 문항" },
            { keys: ["A", "B", "C", "D"], description: "객관식 답변 선택" },
            { keys: ["O", "X"], description: "O/X 답변 선택" },
            { keys: ["S"], description: "건너뛰기" },
            { keys: ["⌘", "Enter"], description: "퀴즈 제출" },
            { keys: ["Esc"], description: "입력 해제" },
          ]}
        />
      )}

      <ShareDialog
        quizId={quiz.id}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
