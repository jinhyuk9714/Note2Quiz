import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WeakConceptsCard } from "../WeakConceptsCard";
import type { WeakConceptItem } from "@/types/api";

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
      screen.getByText("아직 오답 데이터가 없습니다"),
    ).toBeInTheDocument();
  });
});
