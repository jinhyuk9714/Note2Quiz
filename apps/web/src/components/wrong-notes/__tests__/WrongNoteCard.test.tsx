import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { WrongNoteCard } from "../WrongNoteCard";
import type { WrongNote } from "@/types/api";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api", () => ({
  reviewWrongNote: vi.fn(),
}));

import { reviewWrongNote } from "@/lib/api";

const note: WrongNote = {
  id: "note-1",
  quiz_item_id: "qi-1",
  question: "What is the capital?",
  user_answer: "Busan",
  correct_answer: "Seoul",
  wrong_reason: "Seoul is the capital of South Korea.",
  concept_tags: ["geography", "korea"],
  next_review_at: "2025-06-15T00:00:00Z",
  consecutive_correct: 2,
  is_mastered: false,
  created_at: "2025-06-01T00:00:00Z",
};

describe("WrongNoteCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders question, answers, and reason", () => {
    renderWithProviders(<WrongNoteCard note={note} />);
    expect(screen.getByText("What is the capital?")).toBeInTheDocument();
    expect(screen.getByText("Busan")).toBeInTheDocument();
    expect(screen.getByText("Seoul")).toBeInTheDocument();
    expect(
      screen.getByText(/Seoul is the capital/),
    ).toBeInTheDocument();
  });

  it("renders concept tags", () => {
    renderWithProviders(<WrongNoteCard note={note} />);
    expect(screen.getByText("geography")).toBeInTheDocument();
    expect(screen.getByText("korea")).toBeInTheDocument();
  });

  it("renders mastery progress dots", () => {
    const { container } = renderWithProviders(<WrongNoteCard note={note} />);
    const dots = container.querySelectorAll(".rounded-full");
    const masteryDots = Array.from(dots).filter(
      (d) =>
        d.classList.contains("bg-indigo-500") ||
        d.classList.contains("bg-slate-200") ||
        d.classList.contains("bg-emerald-500"),
    );
    expect(masteryDots.length).toBeGreaterThanOrEqual(5);
  });

  it("shows mastered styling when is_mastered is true", () => {
    renderWithProviders(
      <WrongNoteCard note={{ ...note, is_mastered: true, consecutive_correct: 5 }} />,
    );
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("hides review buttons and shows badge when mastered", () => {
    renderWithProviders(
      <WrongNoteCard note={{ ...note, is_mastered: true, consecutive_correct: 5 }} />,
    );
    expect(screen.getByText("숙달 완료")).toBeInTheDocument();
    expect(screen.queryByText("알고 있어요")).not.toBeInTheDocument();
    expect(screen.queryByText("아직 헷갈려요")).not.toBeInTheDocument();
  });

  it("shows review buttons when not mastered", () => {
    renderWithProviders(<WrongNoteCard note={note} />);
    expect(screen.getByText("알고 있어요")).toBeInTheDocument();
    expect(screen.getByText("아직 헷갈려요")).toBeInTheDocument();
    expect(screen.queryByText("숙달 완료")).not.toBeInTheDocument();
  });

  it('calls reviewWrongNote(true) when "알고 있어요" clicked', async () => {
    vi.mocked(reviewWrongNote).mockResolvedValueOnce({
      ...note,
      consecutive_correct: 3,
    });
    renderWithProviders(<WrongNoteCard note={note} />);

    await userEvent.click(screen.getByText("알고 있어요"));
    expect(reviewWrongNote).toHaveBeenCalledWith("note-1", true);
  });

  it('calls reviewWrongNote(false) when "아직 헷갈려요" clicked', async () => {
    vi.mocked(reviewWrongNote).mockResolvedValueOnce({
      ...note,
      consecutive_correct: 0,
    });
    renderWithProviders(<WrongNoteCard note={note} />);

    await userEvent.click(screen.getByText("아직 헷갈려요"));
    expect(reviewWrongNote).toHaveBeenCalledWith("note-1", false);
  });

  it("renders concept tags as clickable links to wrong-notes filter", () => {
    renderWithProviders(<WrongNoteCard note={note} />);
    const geoLink = screen.getByText("geography").closest("a");
    expect(geoLink).toHaveAttribute("href", "/wrong-notes?concept_tag=geography");
    const koreaLink = screen.getByText("korea").closest("a");
    expect(koreaLink).toHaveAttribute("href", "/wrong-notes?concept_tag=korea");
  });
});
