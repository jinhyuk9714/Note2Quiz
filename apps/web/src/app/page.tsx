"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Sparkles, ArrowUpRight, BookOpen } from "lucide-react";

import { getDashboardStats, getDashboardTrends } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LearningProgressCard } from "@/components/dashboard/LearningProgressCard";
import { LearningStreakCard } from "@/components/dashboard/LearningStreakCard";
import { MasterySummaryCard } from "@/components/dashboard/MasterySummaryCard";
import { WeakConceptsCard } from "@/components/dashboard/WeakConceptsCard";
import { ReviewScheduleCard } from "@/components/dashboard/ReviewScheduleCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";

const ChartSkeleton = () => (
  <div className="h-64 animate-pulse rounded-[2rem] bg-surface-alt" />
);

const DailyAccuracyChart = dynamic(
  () => import("@/components/dashboard/DailyAccuracyChart").then((m) => ({ default: m.DailyAccuracyChart })),
  { ssr: false, loading: ChartSkeleton },
);
const ActivityBarChart = dynamic(
  () => import("@/components/dashboard/ActivityBarChart").then((m) => ({ default: m.ActivityBarChart })),
  { ssr: false, loading: ChartSkeleton },
);
const ActiveDaysHeatmap = dynamic(
  () => import("@/components/dashboard/ActiveDaysHeatmap").then((m) => ({ default: m.ActiveDaysHeatmap })),
  { ssr: false, loading: ChartSkeleton },
);
const OnboardingModal = dynamic(
  () => import("@/components/common/OnboardingModal").then((m) => ({ default: m.OnboardingModal })),
  { ssr: false },
);

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: trends, isLoading: isTrendsLoading } = useQuery({
    queryKey: ["dashboard-trends", 30],
    queryFn: () => getDashboardTrends(30),
  });

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("quiznote_onboarding_dismissed") !== null;
  });

  const handleDismissOnboarding = useCallback(() => {
    localStorage.setItem("quiznote_onboarding_dismissed", "1");
    setOnboardingDismissed(true);
  }, []);

  const isNewUser =
    stats !== undefined && stats.learning_progress.documents_studied === 0;

  const showOnboarding = isNewUser && !onboardingDismissed;

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-20 pt-8 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter text-text-primary">
          안녕하세요, {user?.display_name || "학습자"}님 👋
        </h1>
        <p className="text-lg text-text-secondary font-medium tracking-tight">
          오늘도 당신의 성장을 응원합니다. AI와 함께 퀴즈를 풀어보세요.
        </p>
      </div>

      {isLoading && (
        <div className="flex h-96 items-center justify-center bento-card border-dashed">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-black text-text-tertiary uppercase tracking-widest">Analyzing your progress...</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border border-red-100 bg-red-50/50 p-10 text-center shadow-sm dark:border-red-900/30 dark:bg-red-900/10">
          <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
            통계를 불러오는 데 실패했습니다.
          </p>
        </div>
      )}

      {stats && isNewUser && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex flex-col items-center gap-6 bento-card border-dashed px-8 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-inner">
              <BookOpen className="h-10 w-10" />
            </div>
            <div className="max-w-md space-y-3">
              <h2 className="text-2xl font-black tracking-tight text-text-primary">
                성장의 첫 걸음을 떼어보세요
              </h2>
              <p className="text-base font-medium leading-relaxed text-text-secondary">
                아직 학습 데이터가 없네요. PDF 문서를 업로드하면 AI가 분석하여 당신만을 위한 맞춤형 퀴즈를 만들어 드립니다.
              </p>
            </div>
            <Link
              href="/documents"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 dark:shadow-none active:scale-95"
            >
              <PlusCircle className="h-5 w-5" />
              첫 문서 업로드하기
            </Link>
          </div>
        </div>
      )}

      {stats && !isNewUser && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 space-y-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-12">
              <LearningProgressCard stats={stats.learning_progress} />
            </div>
          </div>

          {/* Trends section */}
          <div className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <h2 className="text-2xl font-black tracking-tight text-text-primary">
                학습 트렌드
              </h2>
              <span className="text-xs font-black uppercase tracking-widest text-text-tertiary">
                Recent 30 Days
              </span>
            </div>

            {isTrendsLoading && (
              <div className="flex h-64 items-center justify-center bento-card border-dashed">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            )}

            {trends && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <DailyAccuracyChart data={trends.daily_quiz_trend} />
                </div>
                <div className="lg:col-span-5">
                  <ActiveDaysHeatmap data={trends.daily_quiz_trend} />
                </div>
                <div className="lg:col-span-12">
                  <ActivityBarChart data={trends.daily_quiz_trend} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
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
      <div className="space-y-8">
        <h2 className="text-2xl font-black tracking-tight text-text-primary px-2">새로운 학습 시작하기</h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <Link
            href="/documents"
            className="group bento-card p-10 flex items-start gap-8"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-all duration-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-indigo-300">
              <PlusCircle className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <p className="font-black text-xl text-text-primary truncate">문서 업로드</p>
                <ArrowUpRight className="h-6 w-6 text-text-tertiary transition-all duration-300 group-hover:text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
              <p className="mt-2 text-base font-medium leading-relaxed text-text-secondary">
                PDF나 텍스트 문서를 업로드하여 나만의 퀴즈 데이터베이스를 구축하세요.
              </p>
            </div>
          </Link>

          <Link
            href="/quiz/generate"
            className="group bento-card p-10 flex items-start gap-8"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-all duration-500 group-hover:bg-purple-600 group-hover:text-white group-hover:-rotate-6 group-hover:shadow-lg group-hover:shadow-purple-300">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <p className="font-black text-xl text-text-primary truncate">AI 퀴즈 생성</p>
                <ArrowUpRight className="h-6 w-6 text-text-tertiary transition-all duration-300 group-hover:text-purple-600 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
              <p className="mt-2 text-base font-medium leading-relaxed text-text-secondary">
                AI가 문서를 정밀하게 분석하여 고품질의 연습 문제를 자동으로 만듭니다.
              </p>
            </div>
          </Link>
        </div>
      </div>

      <OnboardingModal
        open={showOnboarding}
        onDismiss={handleDismissOnboarding}
        userName={user?.display_name ?? ""}
      />
    </div>
  );
}
