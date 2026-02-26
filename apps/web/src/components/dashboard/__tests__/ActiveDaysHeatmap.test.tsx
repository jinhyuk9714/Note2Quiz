import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ActiveDaysHeatmap } from "../ActiveDaysHeatmap";
import type { DailyTrendPoint } from "@/types/api";

describe("ActiveDaysHeatmap", () => {
  it("renders section heading", () => {
    render(<ActiveDaysHeatmap data={[]} />);
    expect(screen.getByText("활동 히트맵")).toBeInTheDocument();
  });

  it("shows active day count", () => {
    const data: DailyTrendPoint[] = [
      {
        date: new Date().toISOString().slice(0, 10),
        quiz_count: 1,
        questions_answered: 3,
        accuracy_rate: 1.0,
      },
    ];
    render(<ActiveDaysHeatmap data={data} />);
    expect(screen.getByText("1일 활동")).toBeInTheDocument();
  });

  it("renders 30 heatmap cells", () => {
    const { container } = render(<ActiveDaysHeatmap data={[]} />);
    const cells = container.querySelectorAll(".aspect-square");
    expect(cells.length).toBe(30);
  });
});
