import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ActivityBarChart } from "../ActivityBarChart";
import type { DailyTrendPoint } from "@/types/api";

describe("ActivityBarChart", () => {
  it("renders section heading", () => {
    render(<ActivityBarChart data={[]} />);
    expect(screen.getByText("일별 학습량")).toBeInTheDocument();
  });

  it("renders with data without crashing", () => {
    const data: DailyTrendPoint[] = [
      {
        date: "2026-02-25",
        quiz_count: 2,
        questions_answered: 5,
        accuracy_rate: 0.8,
      },
    ];
    render(<ActivityBarChart data={data} />);
    expect(screen.getByText("일별 학습량")).toBeInTheDocument();
  });
});
