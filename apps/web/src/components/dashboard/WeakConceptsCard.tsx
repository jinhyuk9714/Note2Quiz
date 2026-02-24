import { AlertCircle, Zap } from "lucide-react";
import type { WeakConceptItem } from "@/types/api";

interface WeakConceptsCardProps {
  concepts: WeakConceptItem[];
}

export function WeakConceptsCard({ concepts }: WeakConceptsCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">취약 개념 분석</h2>
        </div>
      </div>

      {concepts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="rounded-full bg-slate-50 p-4">
            <Zap className="h-8 w-8 text-slate-300" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-400">
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
              <li key={c.tag} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 transition-colors group-hover:bg-indigo-100">
                    {c.tag}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-red-500">오답 {c.wrong_count}회</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">숙달 {masteryPercent}%</span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
