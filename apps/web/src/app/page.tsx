"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Sparkles, ArrowUpRight } from "lucide-react";

import { getDashboardStats } from "@/lib/api";
import { LearningProgressCard } from "@/components/dashboard/LearningProgressCard";
import { LearningStreakCard } from "@/components/dashboard/LearningStreakCard";
import { MasterySummaryCard } from "@/components/dashboard/MasterySummaryCard";
import { WeakConceptsCard } from "@/components/dashboard/WeakConceptsCard";
import { ReviewScheduleCard } from "@/components/dashboard/ReviewScheduleCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";

export default function DashboardPage() {
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          안녕하세요, 👋
        </h1>
        <p className="text-slate-500 font-medium">
          오늘도 당신의 학습 성장을 퀴즈노트 AI와 함께하세요.
        </p>
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-400">대시보드를 분석하는 중...</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-600">
            통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-12">
              <LearningProgressCard stats={stats.learning_progress} />
            </div>

            <div className="lg:col-span-5">
              <LearningStreakCard streak={stats.streak} />
            </div>

            <div className="lg:col-span-7">
              <MasterySummaryCard summary={stats.mastery_summary} />
            </div>

            <div className="lg:col-span-7">
              <WeakConceptsCard concepts={stats.weak_concepts} />
            </div>

            <div className="lg:col-span-5">
              <ReviewScheduleCard schedule={stats.review_schedule} />
            </div>

            <div className="lg:col-span-12">
              <RecentActivityCard activities={stats.recent_activity} />
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-800 px-1">새로운 학습 시작하기</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Link
            href="/documents"
            className="group relative flex items-start gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6">
              <PlusCircle className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-lg text-slate-800 truncate">문서 업로드</p>
                <ArrowUpRight className="h-5 w-5 text-slate-300 transition-all duration-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                PDF나 텍스트 문서를 업로드하여 나만의 퀴즈 데이터베이스를 구축하세요.
              </p>
            </div>
          </Link>

          <Link
            href="/quiz/generate"
            className="group relative flex items-start gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/10 active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-all duration-300 group-hover:bg-purple-600 group-hover:text-white group-hover:-rotate-6">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-lg text-slate-800 truncate">AI 퀴즈 생성</p>
                <ArrowUpRight className="h-5 w-5 text-slate-300 transition-all duration-300 group-hover:text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                AI가 문서를 정밀하게 분석하여 고품질의 연습 문제를 자동으로 만듭니다.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
