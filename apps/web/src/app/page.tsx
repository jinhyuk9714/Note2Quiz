"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { getDashboardStats } from "@/lib/api";
import { LearningProgressCard } from "@/components/dashboard/LearningProgressCard";
import { WeakConceptsCard } from "@/components/dashboard/WeakConceptsCard";
import { ReviewScheduleCard } from "@/components/dashboard/ReviewScheduleCard";

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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">QuizNote AI</h1>
        <p className="mt-1 text-sm text-gray-500">
          강의자료 기반 퀴즈 자동 생성 + 오답노트 학습
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400">대시보드를 불러오는 중...</p>
      )}

      {isError && (
        <p className="text-sm text-red-500">
          통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {stats && (
        <>
          <LearningProgressCard stats={stats.learning_progress} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <WeakConceptsCard concepts={stats.weak_concepts} />
            <ReviewScheduleCard schedule={stats.review_schedule} />
          </div>
        </>
      )}

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">빠른 시작</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/documents"
            className="rounded-lg border border-gray-200 bg-white p-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <p className="text-sm font-medium text-indigo-600">문서 업로드</p>
            <p className="mt-1 text-xs text-gray-500">
              강의 노트를 업로드하세요
            </p>
          </Link>
          <Link
            href="/quiz/generate"
            className="rounded-lg border border-gray-200 bg-white p-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <p className="text-sm font-medium text-indigo-600">퀴즈 생성</p>
            <p className="mt-1 text-xs text-gray-500">
              문서 기반 퀴즈를 만드세요
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
