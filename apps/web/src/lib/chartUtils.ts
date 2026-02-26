import type { DailyTrendPoint } from "@/types/api";

/**
 * Fill in missing dates with zero-value entries so charts span the full window.
 */
export function fillDateGaps(
  data: DailyTrendPoint[],
  days: number,
): DailyTrendPoint[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result: DailyTrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(
      map.get(key) ?? {
        date: key,
        quiz_count: 0,
        questions_answered: 0,
        accuracy_rate: 0,
      },
    );
  }

  return result;
}

/**
 * Format an ISO date string to a short Korean date like "2월 25일".
 */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(d);
}
