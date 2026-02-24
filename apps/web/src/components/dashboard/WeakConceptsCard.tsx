import type { WeakConceptItem } from "@/types/api";

interface WeakConceptsCardProps {
  concepts: WeakConceptItem[];
}

export function WeakConceptsCard({ concepts }: WeakConceptsCardProps) {
  if (concepts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">취약 개념</h2>
        <p className="mt-3 text-sm text-gray-400">
          아직 오답 데이터가 없습니다
        </p>
      </div>
    );
  }

  const maxCount = concepts[0]?.wrong_count ?? 1;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">취약 개념</h2>
      <ul className="space-y-3">
        {concepts.map((c) => {
          const masteryPercent =
            c.total_count > 0
              ? Math.round((c.mastered_count / c.total_count) * 100)
              : 0;
          const barWidth = Math.round((c.wrong_count / maxCount) * 100);

          return (
            <li key={c.tag}>
              <div className="flex items-center justify-between text-sm">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                  {c.tag}
                </span>
                <span className="text-xs text-gray-400">
                  오답 {c.wrong_count}회 · 숙달 {masteryPercent}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-red-400 transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
