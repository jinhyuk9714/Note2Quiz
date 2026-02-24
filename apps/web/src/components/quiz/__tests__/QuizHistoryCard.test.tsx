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
  created_at: "2025-06-01T10:00:00Z",
};

describe("QuizHistoryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders title and item count", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.getByText("OS Fundamentals Quiz")).toBeInTheDocument();
    expect(screen.getByText(/5문제/)).toBeInTheDocument();
  });

  it("shows view and delete buttons", () => {
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    expect(screen.getByText("보기")).toBeInTheDocument();
    expect(screen.getByText("삭제")).toBeInTheDocument();
  });

  it("calls deleteQuiz after confirm", async () => {
    vi.mocked(deleteQuiz).mockResolvedValueOnce(undefined);
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    await userEvent.click(screen.getByText("삭제"));
    expect(deleteQuiz).toHaveBeenCalledWith("quiz-1");
  });

  it("does not call deleteQuiz when confirm cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithProviders(<QuizHistoryCard quiz={quiz} />);
    await userEvent.click(screen.getByText("삭제"));
    expect(deleteQuiz).not.toHaveBeenCalled();
  });
});
