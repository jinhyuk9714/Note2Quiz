import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { RecentActivityCard } from "../RecentActivityCard";
import type { RecentActivityItem } from "@/types/api";

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

const activities: RecentActivityItem[] = [
  {
    type: "document_uploaded",
    title: "알고리즘 강의노트",
    description: "5개 섹션",
    entity_id: "doc-1",
    created_at: new Date().toISOString(),
  },
  {
    type: "quiz_attempted",
    title: "자료구조 퀴즈",
    description: "4/5 정답",
    entity_id: "quiz-1",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe("RecentActivityCard", () => {
  it("renders activity titles and descriptions", () => {
    render(<RecentActivityCard activities={activities} />);
    expect(screen.getByText("알고리즘 강의노트")).toBeInTheDocument();
    expect(screen.getByText("5개 섹션")).toBeInTheDocument();
    expect(screen.getByText("자료구조 퀴즈")).toBeInTheDocument();
    expect(screen.getByText("4/5 정답")).toBeInTheDocument();
  });

  it("renders correct link for document activity", () => {
    render(<RecentActivityCard activities={activities} />);
    const docLink = screen.getByText("알고리즘 강의노트").closest("a");
    expect(docLink).toHaveAttribute("href", "/documents/doc-1");
  });

  it("renders correct link for quiz activity", () => {
    render(<RecentActivityCard activities={activities} />);
    const quizLink = screen.getByText("자료구조 퀴즈").closest("a");
    expect(quizLink).toHaveAttribute("href", "/quiz/quiz-1");
  });

  it("renders empty state when no activities", () => {
    render(<RecentActivityCard activities={[]} />);
    expect(screen.getByText("아직 활동이 없습니다")).toBeInTheDocument();
  });

  it("shows activity count badge", () => {
    render(<RecentActivityCard activities={activities} />);
    expect(screen.getByText("2개")).toBeInTheDocument();
  });

  it("shows type labels", () => {
    render(<RecentActivityCard activities={activities} />);
    expect(screen.getByText("문서 업로드")).toBeInTheDocument();
    expect(screen.getByText("퀴즈 풀기")).toBeInTheDocument();
  });
});
