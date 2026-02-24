import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LearningProgressCard } from "../LearningProgressCard";
import type { LearningProgressStats } from "@/types/api";

const stats: LearningProgressStats = {
  total_quizzes_taken: 12,
  total_questions_answered: 60,
  total_correct: 45,
  accuracy_rate: 0.75,
  documents_studied: 5,
};

describe("LearningProgressCard", () => {
  it("renders all stat numbers", () => {
    render(<LearningProgressCard stats={stats} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("displays accuracy percentage", () => {
    render(<LearningProgressCard stats={stats} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("45 / 60 정답")).toBeInTheDocument();
  });

  it("shows 0% when no questions answered", () => {
    const empty: LearningProgressStats = {
      total_quizzes_taken: 0,
      total_questions_answered: 0,
      total_correct: 0,
      accuracy_rate: 0,
      documents_studied: 0,
    };
    render(<LearningProgressCard stats={empty} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
