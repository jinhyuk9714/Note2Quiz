import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { WeakConceptsCard } from "../WeakConceptsCard";
import type { WeakConceptItem } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const concepts: WeakConceptItem[] = [
  { tag: "calculus", wrong_count: 8, mastered_count: 2, total_count: 8 },
  { tag: "algebra", wrong_count: 5, mastered_count: 3, total_count: 5 },
];

describe("WeakConceptsCard", () => {
  it("renders concept tags with counts", () => {
    render(<WeakConceptsCard concepts={concepts} />);
    expect(screen.getByText("calculus")).toBeInTheDocument();
    expect(screen.getByText("algebra")).toBeInTheDocument();
    expect(screen.getByText(/오답 8회/)).toBeInTheDocument();
    expect(screen.getByText(/숙달 25%/)).toBeInTheDocument();
  });

  it("shows empty state when no concepts", () => {
    render(<WeakConceptsCard concepts={[]} />);
    expect(
      screen.getByText(/아직 충분한 오답 데이터가 없습니다/),
    ).toBeInTheDocument();
  });

  it("links concept tags to wrong-notes page with concept_tag param", () => {
    render(<WeakConceptsCard concepts={concepts} />);
    const calculusLink = screen.getByText("calculus").closest("a");
    expect(calculusLink).toHaveAttribute("href", "/wrong-notes?concept_tag=calculus");
    const algebraLink = screen.getByText("algebra").closest("a");
    expect(algebraLink).toHaveAttribute("href", "/wrong-notes?concept_tag=algebra");
  });

  it("links to quiz generation with focus_concept param", () => {
    render(<WeakConceptsCard concepts={concepts} />);
    const links = screen.getAllByRole("link");
    const quizLinks = links.filter((l) =>
      l.getAttribute("href")?.startsWith("/quiz/generate"),
    );
    expect(quizLinks).toHaveLength(2);
    expect(quizLinks[0]).toHaveAttribute("href", "/quiz/generate?focus_concept=calculus");
    expect(quizLinks[1]).toHaveAttribute("href", "/quiz/generate?focus_concept=algebra");
  });

  it("has no links when empty", () => {
    render(<WeakConceptsCard concepts={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
