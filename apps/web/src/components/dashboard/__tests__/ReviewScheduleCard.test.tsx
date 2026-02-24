import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReviewScheduleCard } from "../ReviewScheduleCard";
import type { ReviewScheduleStats } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ReviewScheduleCard", () => {
  it("renders overdue and today counts", () => {
    const schedule: ReviewScheduleStats = {
      overdue_count: 3,
      today_count: 2,
      upcoming: [],
    };
    render(<ReviewScheduleCard schedule={schedule} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows review button when there is work to do", () => {
    const schedule: ReviewScheduleStats = {
      overdue_count: 1,
      today_count: 0,
      upcoming: [],
    };
    render(<ReviewScheduleCard schedule={schedule} />);
    expect(screen.getByText("복습 시작하기")).toBeInTheDocument();
  });

  it("hides review button when everything is clear", () => {
    const schedule: ReviewScheduleStats = {
      overdue_count: 0,
      today_count: 0,
      upcoming: [{ date: "2026-03-01", count: 2 }],
    };
    render(<ReviewScheduleCard schedule={schedule} />);
    expect(screen.queryByText("복습 시작하기")).not.toBeInTheDocument();
  });

  it("renders upcoming days", () => {
    const schedule: ReviewScheduleStats = {
      overdue_count: 0,
      today_count: 0,
      upcoming: [
        { date: "2026-03-01", count: 5 },
        { date: "2026-03-03", count: 2 },
      ],
    };
    render(<ReviewScheduleCard schedule={schedule} />);
    expect(screen.getByText("5개")).toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();
  });
});
