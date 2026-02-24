import type { LearningProgressStats } from "@/types/api";

interface LearningProgressCardProps {
  stats: LearningProgressStats;
}

export function LearningProgressCard({ stats }: LearningProgressCardProps) {
  const accuracyPercent = Math.round(stats.accuracy_rate * 100);

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">학습 진도</h2>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">풀이 퀴즈</p>
          <p className="mt-1 text-2xl font-bold">{stats.total_quizzes_taken}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">학습 문서</p>
          <p className="mt-1 text-2xl font-bold">{stats.documents_studied}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">총 문제</p>
          <p className="mt-1 text-2xl font-bold">
            {stats.total_questions_answered}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">정답률</span>
          <span className="font-semibold">{accuracyPercent}%</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${accuracyPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {stats.total_correct} / {stats.total_questions_answered} 정답
        </p>
      </div>
    </div>
  );
}
