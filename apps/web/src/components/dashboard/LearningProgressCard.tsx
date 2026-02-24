import { BarChart3, FileText, CheckCircle2, Target } from "lucide-react";
import type { LearningProgressStats } from "@/types/api";

interface LearningProgressCardProps {
  stats: LearningProgressStats;
}

export function LearningProgressCard({ stats }: LearningProgressCardProps) {
  const accuracyPercent = Math.round(stats.accuracy_rate * 100);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Target className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">학습 통계 요약</h2>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <BarChart3 className="h-4 w-4" />
            풀이 퀴즈
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.total_quizzes_taken}</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <FileText className="h-4 w-4" />
            학습 문서
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.documents_studied}</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <CheckCircle2 className="h-4 w-4" />
            총 문제
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.total_questions_answered}</p>
        </div>
        <div className="flex flex-col justify-center border-l border-slate-100 pl-0 md:pl-8">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-slate-500">종합 정답률</span>
            <span className="text-indigo-600">{accuracyPercent}%</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-1000"
              style={{ width: `${accuracyPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {stats.total_correct} / {stats.total_questions_answered} 정답
          </p>
        </div>
      </div>
    </div>
  );
}
