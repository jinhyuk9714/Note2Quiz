import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DailyAccuracyChart } from "../DailyAccuracyChart";
import type { DailyTrendPoint } from "@/types/api";

describe("DailyAccuracyChart", () => {
  it("renders section heading", () => {
    render(<DailyAccuracyChart data={[]} />);
    expect(screen.getByText("정답률 추이")).toBeInTheDocument();
  });

  it("renders with data without crashing", () => {
    const data: DailyTrendPoint[] = [
      {
        date: "2026-02-25",
        quiz_count: 3,
        questions_answered: 10,
        accuracy_rate: 0.7,
      },
    ];
    render(<DailyAccuracyChart data={data} />);
    expect(screen.getByText("정답률 추이")).toBeInTheDocument();
  });
});
