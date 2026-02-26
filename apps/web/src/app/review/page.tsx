"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  PlayCircle,
  Tag,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

import { listWrongNotes, getDashboardStats } from "@/lib/api";
import { ReviewSession } from "@/components/wrong-notes/ReviewSession";
import { cn } from "@/lib/utils";

function formatKoreanDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [reviewMode, setReviewMode] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: dueData, isLoading: isDueLoading } = useQuery({
    queryKey: ["review-due-count", selectedTag],
    queryFn: () =>
      listWrongNotes({
        due_only: true,
        limit: 1,
        offset: 0,
        concept_tag: selectedTag ?? undefined,
      }),
  });

  const { data: reviewData, isLoading: isReviewLoading } = useQuery({
    queryKey: ["review-session-notes", selectedTag],
    queryFn: () =>
      listWrongNotes({
        due_only: true,
        limit: 200,
        offset: 0,
        concept_tag: selectedTag ?? undefined,
      }),
    enabled: reviewMode,
    staleTime: 0,
  });

  const schedule = stats?.review_schedule;
  const weakConcepts = stats?.weak_concepts ?? [];
  const dueTotal = dueData?.total ?? 0;
  const reviewNotes = reviewData?.notes ?? [];

  function handleStartReview() {
    setReviewMode(true);
  }

  function handleExitReview() {
    setReviewMode(false);
    void queryClient.invalidateQueries({ queryKey: ["review-due-count"] });
    void queryClient.invalidateQueries({ queryKey: ["review-session-notes"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  // Session mode
  if (reviewMode && reviewNotes.length > 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-10 pb-12">
        <ReviewSession
          notes={reviewNotes}
          onExit={handleExitReview}
          backLabel="복습 홈으로 돌아가기"
        />
      </div>
    );
  }

  // Loading state
  if (isStatsLoading || isDueLoading) {
    return (
      <div className="mx-auto max-w-4xl pb-12">
        <div className="flex h-64 items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-400">
              복습 현황을 불러오는 중...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const upcomingTotal = schedule?.upcoming.reduce((s, d) => s + d.count, 0) ?? 0;

  // Landing mode
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          복습
        </h1>
        <p className="font-medium text-slate-500">
          간격 반복 학습으로 기억을 강화하세요.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-3xl border p-6 shadow-sm transition-all",
            (schedule?.overdue_count ?? 0) > 0
              ? "border-red-100 bg-red-50"
              : "border-slate-200 bg-white",
          )}
        >
          <AlertTriangle
            className={cn(
              "h-6 w-6",
              (schedule?.overdue_count ?? 0) > 0
                ? "text-red-500"
                : "text-slate-300",
            )}
          />
          <p
            className={cn(
              "mt-2 text-3xl font-black",
              (schedule?.overdue_count ?? 0) > 0
                ? "text-red-600"
                : "text-slate-300",
            )}
          >
            {schedule?.overdue_count ?? 0}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">기한 지남</p>
        </div>

        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-3xl border p-6 shadow-sm transition-all",
            (schedule?.today_count ?? 0) > 0
              ? "border-amber-100 bg-amber-50"
              : "border-slate-200 bg-white",
          )}
        >
          <CalendarCheck
            className={cn(
              "h-6 w-6",
              (schedule?.today_count ?? 0) > 0
                ? "text-amber-500"
                : "text-slate-300",
            )}
          />
          <p
            className={cn(
              "mt-2 text-3xl font-black",
              (schedule?.today_count ?? 0) > 0
                ? "text-amber-600"
                : "text-slate-300",
            )}
          >
            {schedule?.today_count ?? 0}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">오늘 복습</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all">
          <Clock className="h-6 w-6 text-slate-300" />
          <p className="mt-2 text-3xl font-black text-slate-400">
            {upcomingTotal}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">다가오는 복습</p>
        </div>
      </div>

      {/* Concept tag filter */}
      {weakConcepts.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-xs font-black uppercase tracking-[0.1em] text-slate-400">
            개념별 필터
          </p>
          <div className="flex flex-wrap gap-2">
            {weakConcepts.map((c) => (
              <div key={c.tag} className="inline-flex items-center gap-0.5">
                <button
                  onClick={() =>
                    setSelectedTag((prev) =>
                      prev === c.tag ? null : c.tag,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-l-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95",
                    selectedTag === c.tag
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-800",
                  )}
                >
                  <Tag className="h-3 w-3" />
                  {c.tag}
                  {selectedTag === c.tag && <X className="h-3 w-3" />}
                </button>
                <Link
                  href={`/quiz/generate?focus_concept=${encodeURIComponent(c.tag)}`}
                  className={cn(
                    "inline-flex items-center rounded-r-full px-2 py-1.5 text-xs transition-all hover:bg-indigo-50 active:scale-95",
                    selectedTag === c.tag
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : "bg-white text-indigo-600 ring-1 ring-inset ring-slate-200 hover:text-indigo-700",
                  )}
                  title={`${c.tag} 집중 퀴즈 생성`}
                >
                  <Sparkles className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start review CTA */}
      {dueTotal > 0 ? (
        <button
          onClick={handleStartReview}
          disabled={isReviewLoading}
          className="flex w-full items-center justify-center gap-3 rounded-3xl bg-indigo-600 py-5 text-base font-bold text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-70"
        >
          {isReviewLoading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <PlayCircle className="h-5 w-5" />
          )}
          복습 시작 ({dueTotal}개)
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center backdrop-blur-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            모든 복습을 마쳤습니다!
          </h3>
          <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-slate-500">
            새로운 퀴즈에 도전하여 오답노트를 쌓아보세요.
          </p>
          <Link
            href="/quiz/generate"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            새로운 퀴즈 시작하기
          </Link>
        </div>
      )}

      {/* Upcoming schedule */}
      {schedule && schedule.upcoming.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2 px-1">
            <Clock className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
              주간 계획
            </p>
          </div>
          <ul className="space-y-2">
            {schedule.upcoming.map((day) => (
              <li
                key={day.date}
                className="group flex items-center justify-between rounded-xl border border-transparent bg-slate-50/50 px-4 py-3 text-sm transition-all hover:border-slate-200 hover:bg-white"
              >
                <span className="font-semibold text-slate-600 transition-colors group-hover:text-slate-900">
                  {formatKoreanDate(day.date)}
                </span>
                <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all group-hover:text-indigo-600 group-hover:ring-indigo-200">
                  {day.count}개
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
