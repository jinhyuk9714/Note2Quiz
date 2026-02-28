import Link from "next/link";
import { AlertCircle, Sparkles, Zap } from "lucide-react";
import type { WeakConceptItem } from "@/types/api";

interface WeakConceptsCardProps {
  concepts: WeakConceptItem[];
}

export function WeakConceptsCard({ concepts }: WeakConceptsCardProps) {
  return (
    <div className="bento-card flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">취약 개념 분석</h2>
        </div>
      </div>

      {concepts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="rounded-full bg-surface-alt p-4">
            <Zap className="h-8 w-8 text-text-tertiary" />
          </div>
          <p className="mt-4 text-sm font-medium text-text-tertiary">
            아직 충분한 오답 데이터가 없습니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {concepts.slice(0, 5).map((c) => {
            const masteryPercent =
              c.total_count > 0
                ? Math.round((c.mastered_count / c.total_count) * 100)
                : 0;
            const maxWrong = concepts[0]?.wrong_count || 1;
            const barWidth = Math.round((c.wrong_count / maxWrong) * 100);

            return (
              <li key={c.tag}>
                <div className="rounded-2xl p-3 -mx-3 transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                  <div className="flex items-center justify-between mb-2">
                    <Link
                      href={`/wrong-notes?concept_tag=${encodeURIComponent(c.tag)}`}
                      className="inline-flex items-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                    >
                      {c.tag}
                    </Link>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="text-red-500 dark:text-red-400">오답 {c.wrong_count}회</span>
                      <span className="text-text-tertiary">|</span>
                      <span className="text-text-tertiary">숙달 {masteryPercent}%</span>
                      <Link
                        href={`/quiz/generate?focus_concept=${encodeURIComponent(c.tag)}`}
                        className="ml-1 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        퀴즈
                      </Link>
                    </div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-alt ring-1 ring-inset ring-border-default">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
