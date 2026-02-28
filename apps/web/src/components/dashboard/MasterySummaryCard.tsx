import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";
import type { MasterySummaryStats } from "@/types/api";

interface MasterySummaryCardProps {
  summary: MasterySummaryStats;
}

export function MasterySummaryCard({ summary }: MasterySummaryCardProps) {
  const masteryPercent = Math.round(summary.mastery_rate * 100);
  const remaining = summary.total_wrong_notes - summary.mastered_count;

  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
          <Award className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">오답 마스터리</h2>
      </div>

      {summary.total_wrong_notes === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-text-tertiary italic">
            퀴즈를 풀면 오답노트가 자동 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{summary.mastered_count}</span>
            <span className="text-lg font-bold text-text-tertiary">/ {summary.total_wrong_notes}</span>
          </div>
          <p className="mt-1 text-sm font-bold text-text-tertiary">오답노트 마스터 완료</p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-text-tertiary">마스터리 진행률</span>
              <span className="text-emerald-600 dark:text-emerald-400">{masteryPercent}%</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-alt ring-1 ring-inset ring-border-default">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000"
                style={{ width: `${masteryPercent}%` }}
              />
            </div>
            {remaining > 0 && (
              <p className="mt-2 text-xs font-medium text-text-tertiary">
                {remaining}개의 오답노트가 복습을 기다리고 있습니다
              </p>
            )}
          </div>
        </div>
      )}

      {summary.total_wrong_notes > 0 && (
        <div className="mt-6 flex gap-3">
          <Link
            href="/wrong-notes"
            className="group flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all hover:bg-emerald-700 hover:shadow-emerald-300 dark:hover:shadow-emerald-900/40 active:scale-95"
          >
            오답노트 보기
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          {summary.mastered_count > 0 && (
            <Link
              href="/wrong-notes?tab=mastered"
              className="group flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-95"
            >
              숙달 완료 보기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
