import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import { QuizHistoryCard } from "../QuizHistoryCard";
import type { QuizListItem } from "@/types/api";

vi.mock("@/lib/api", () => ({
  deleteQuiz: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { deleteQuiz } from "@/lib/api";

const quiz: QuizListItem = {
  id: "quiz-1",
  title: "OS Fundamentals Quiz",
  item_count: 5,
  document_id: "doc-1",
  document_title: "운영체제 강의노트",
  created_at: "2025-06-01T10:00:00Z",
  attempt_count: 0,
  latest_score: null,
  latest_total: null,
};

describe("QuizHistoryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and item count", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.getByText("OS Fundamentals Quiz")).toBeInTheDocument();
    expect(screen.getByText(/5문제/)).toBeInTheDocument();
  });

  it("shows delete button", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.getByTitle("삭제")).toBeInTheDocument();
  });

  it("calls deleteQuiz after confirm dialog", async () => {
    vi.mocked(deleteQuiz).mockResolvedValueOnce(undefined);
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    await userEvent.click(screen.getByTitle("삭제"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    const confirmBtn = dialog.querySelector("button:last-child") as HTMLButtonElement;
    await userEvent.click(confirmBtn);
    expect(deleteQuiz).toHaveBeenCalledWith("quiz-1");
  });

  it("does not call deleteQuiz when confirm dialog cancelled", async () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    await userEvent.click(screen.getByTitle("삭제"));
    const dialog = screen.getByRole("alertdialog");
    const cancelBtn = dialog.querySelector("button:first-child") as HTMLButtonElement;
    await userEvent.click(cancelBtn);
    expect(deleteQuiz).not.toHaveBeenCalled();
  });

  it("shows score and attempt count when attempts exist", () => {
    const quizWithAttempts: QuizListItem = {
      ...quiz,
      attempt_count: 3,
      latest_score: 4,
      latest_total: 5,
    };
    renderWithProviders(<QuizHistoryCard quiz={quizWithAttempts} />);
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("3회 풀이")).toBeInTheDocument();
  });

  it("does not show score when no attempts", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.queryByText(/회 풀이/)).not.toBeInTheDocument();
  });

  it("shows document title", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.getByText("운영체제 강의노트")).toBeInTheDocument();
  });
});
