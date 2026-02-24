import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { ReviewSession } from "../ReviewSession";
import type { WrongNote } from "@/types/api";

vi.mock("@/lib/api", () => ({
  reviewWrongNote: vi.fn(),
}));

import { reviewWrongNote } from "@/lib/api";

const notes: WrongNote[] = [
  {
    id: "note-1",
    quiz_item_id: "qi-1",
    question: "What is the capital of Korea?",
    user_answer: "Busan",
    correct_answer: "Seoul",
    wrong_reason: "Seoul is the capital.",
    concept_tags: ["geography"],
    next_review_at: "2025-06-01T00:00:00Z",
    consecutive_correct: 1,
    is_mastered: false,
    created_at: "2025-05-01T00:00:00Z",
  },
  {
    id: "note-2",
    quiz_item_id: "qi-2",
    question: "What is 2 + 2?",
    user_answer: "5",
    correct_answer: "4",
    wrong_reason: "Basic arithmetic.",
    concept_tags: ["math"],
    next_review_at: "2025-06-01T00:00:00Z",
    consecutive_correct: 0,
    is_mastered: false,
    created_at: "2025-05-01T00:00:00Z",
  },
];

describe("ReviewSession", () => {
  const onExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("shows first card question on front", () => {
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);
    expect(screen.getByText("What is the capital of Korea?")).toBeInTheDocument();
  });

  it("shows concept tags on front", () => {
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);
    expect(screen.getByText("geography")).toBeInTheDocument();
  });

  it("shows progress counter", () => {
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it('shows "정답 보기" button initially', () => {
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);
    expect(screen.getByText("정답 보기")).toBeInTheDocument();
  });

  it("does not show review buttons before flip", () => {
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);
    expect(screen.queryByText("알고 있어요")).not.toBeInTheDocument();
    expect(screen.queryByText("아직 헷갈려요")).not.toBeInTheDocument();
  });

  it("reveals answers and review buttons after clicking 정답 보기", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    await user.click(screen.getByText("정답 보기"));

    expect(screen.getByText("Seoul")).toBeInTheDocument();
    expect(screen.getByText("Busan")).toBeInTheDocument();
    expect(screen.getByText("알고 있어요")).toBeInTheDocument();
    expect(screen.getByText("아직 헷갈려요")).toBeInTheDocument();
  });

  it("calls API and advances to next card on correct review", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reviewWrongNote).mockResolvedValueOnce({
      ...notes[0],
      consecutive_correct: 2,
      is_mastered: false,
    });

    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));

    expect(reviewWrongNote).toHaveBeenCalledWith("note-1", true);

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("calls API with false on incorrect review", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reviewWrongNote).mockResolvedValueOnce({
      ...notes[0],
      consecutive_correct: 0,
      is_mastered: false,
    });

    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("아직 헷갈려요"));

    expect(reviewWrongNote).toHaveBeenCalledWith("note-1", false);
  });

  it("shows summary after all cards are reviewed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reviewWrongNote)
      .mockResolvedValueOnce({ ...notes[0], consecutive_correct: 2, is_mastered: false })
      .mockResolvedValueOnce({ ...notes[1], consecutive_correct: 0, is_mastered: false });

    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    // Review first card (correct)
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));
    vi.advanceTimersByTime(350);

    // Review second card (incorrect)
    await waitFor(() => {
      expect(screen.getByText("정답 보기")).toBeInTheDocument();
    });
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("아직 헷갈려요"));
    vi.advanceTimersByTime(350);

    // Summary should appear
    await waitFor(() => {
      expect(screen.getByText("Review Complete")).toBeInTheDocument();
    });
    expect(screen.getByText("2개 문항 복습 완료")).toBeInTheDocument();
  });

  it("calls onExit when back button clicked in summary", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reviewWrongNote)
      .mockResolvedValueOnce({ ...notes[0], consecutive_correct: 2, is_mastered: false })
      .mockResolvedValueOnce({ ...notes[1], consecutive_correct: 1, is_mastered: false });

    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    // Review both cards
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("정답 보기")).toBeInTheDocument();
    });
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("오답노트로 돌아가기")).toBeInTheDocument();
    });
    await user.click(screen.getByText("오답노트로 돌아가기"));

    expect(onExit).toHaveBeenCalled();
  });

  it("shows newly mastered count in summary", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(reviewWrongNote)
      .mockResolvedValueOnce({ ...notes[0], consecutive_correct: 5, is_mastered: true })
      .mockResolvedValueOnce({ ...notes[1], consecutive_correct: 1, is_mastered: false });

    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    // Review first (mastered)
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));
    vi.advanceTimersByTime(350);

    // Review second
    await waitFor(() => {
      expect(screen.getByText("정답 보기")).toBeInTheDocument();
    });
    await user.click(screen.getByText("정답 보기"));
    await user.click(screen.getByText("알고 있어요"));
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/1개 문항 마스터리 달성/)).toBeInTheDocument();
    });
  });

  it("calls onExit when 나가기 button clicked during review", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<ReviewSession notes={notes} onExit={onExit} />);

    await user.click(screen.getByText("나가기"));
    expect(onExit).toHaveBeenCalled();
  });
});
