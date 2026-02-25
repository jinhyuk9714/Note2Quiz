import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LearningStreakCard } from "../LearningStreakCard";
import type { StreakStats } from "@/types/api";

const activeStreak: StreakStats = {
  current_streak_days: 5,
  longest_streak_days: 12,
  total_active_days: 30,
  last_activity_date: "2026-02-25",
};

const noStreak: StreakStats = {
  current_streak_days: 0,
  longest_streak_days: 0,
  total_active_days: 0,
  last_activity_date: null,
};

describe("LearningStreakCard", () => {
  it("renders current streak number", () => {
    render(<LearningStreakCard streak={activeStreak} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows longest streak and total active days", () => {
    render(<LearningStreakCard streak={activeStreak} />);
    expect(screen.getByText(/12일/)).toBeInTheDocument();
    expect(screen.getByText(/30일/)).toBeInTheDocument();
  });

  it("shows active message when streak > 0", () => {
    render(<LearningStreakCard streak={activeStreak} />);
    expect(screen.getByText(/연속 학습 중/)).toBeInTheDocument();
  });

  it("shows encouragement when streak is 0", () => {
    render(<LearningStreakCard streak={noStreak} />);
    expect(screen.getByText(/첫 퀴즈를 풀어보세요/)).toBeInTheDocument();
  });
});
