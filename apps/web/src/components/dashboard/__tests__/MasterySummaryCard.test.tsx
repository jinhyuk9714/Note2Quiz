import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { MasterySummaryCard } from "../MasterySummaryCard";
import type { MasterySummaryStats } from "@/types/api";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const partialMastery: MasterySummaryStats = {
  total_wrong_notes: 10,
  mastered_count: 4,
  mastery_rate: 0.4,
};

const emptyNotes: MasterySummaryStats = {
  total_wrong_notes: 0,
  mastered_count: 0,
  mastery_rate: 0,
};

describe("MasterySummaryCard", () => {
  it("renders mastered count and total", () => {
    render(<MasterySummaryCard summary={partialMastery} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it("shows mastery percentage", () => {
    render(<MasterySummaryCard summary={partialMastery} />);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("shows remaining count", () => {
    render(<MasterySummaryCard summary={partialMastery} />);
    expect(screen.getByText(/6개의 오답노트가 복습을 기다리고 있습니다/)).toBeInTheDocument();
  });

  it("shows empty state when no notes", () => {
    render(<MasterySummaryCard summary={emptyNotes} />);
    expect(screen.getByText(/퀴즈를 풀면 오답노트가 자동 생성됩니다/)).toBeInTheDocument();
  });

  it("shows link to wrong notes when notes exist", () => {
    render(<MasterySummaryCard summary={partialMastery} />);
    expect(screen.getByText("오답노트 보기")).toBeInTheDocument();
  });

  it("hides link when no notes", () => {
    render(<MasterySummaryCard summary={emptyNotes} />);
    expect(screen.queryByText("오답노트 보기")).not.toBeInTheDocument();
  });
});
