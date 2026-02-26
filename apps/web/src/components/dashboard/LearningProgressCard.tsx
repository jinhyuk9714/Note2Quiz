import { BarChart3, FileText, CheckCircle2, Target } from "lucide-react";
import type { LearningProgressStats } from "@/types/api";

interface LearningProgressCardProps {
  stats: LearningProgressStats;
}

export function LearningProgressCard({ stats }: LearningProgressCardProps) {
  const accuracyPercent = Math.round(stats.accuracy_rate * 100);

  return (
    <div className="bento-card p-10 hover:border-indigo-400/50">
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <Target className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-text-primary">학습 통계 요약</h2>
          <p className="text-sm font-medium text-text-tertiary">전체적인 학습 진행 상황을 확인하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        <div className="flex flex-col gap-2 p-6 rounded-3xl bg-surface-alt border border-border-default">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-tertiary">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            풀이 퀴즈
          </div>
          <p className="text-4xl font-black text-text-primary tracking-tighter">{stats.total_quizzes_taken}</p>
        </div>
        <div className="flex flex-col gap-2 p-6 rounded-3xl bg-surface-alt border border-border-default">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-tertiary">
            <FileText className="h-4 w-4 text-emerald-500" />
            학습 문서
          </div>
          <p className="text-4xl font-black text-text-primary tracking-tighter">{stats.documents_studied}</p>
        </div>
        <div className="flex flex-col gap-2 p-6 rounded-3xl bg-surface-alt border border-border-default">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-tertiary">
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
            총 문제
          </div>
          <p className="text-4xl font-black text-text-primary tracking-tighter">{stats.total_questions_answered}</p>
        </div>
        
        <div className="flex flex-col justify-center p-6 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
          <div className="flex items-center justify-between text-sm font-black mb-3">
            <span className="opacity-90">종합 정답률</span>
            <span className="text-xl tracking-tighter">{accuracyPercent}%</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
              style={{ width: `${accuracyPercent}%` }}
            />
          </div>
          <p className="mt-3 text-xs font-medium text-indigo-100 opacity-90">
            {stats.total_correct} / {stats.total_questions_answered} 정답
          </p>
        </div>
      </div>
    </div>
  );
}
