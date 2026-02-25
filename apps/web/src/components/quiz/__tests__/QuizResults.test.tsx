import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizResults } from "../QuizResults";
import type { SubmitResult, QuizItem } from "@/types/api";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

const items: QuizItem[] = [
  {
    id: "q1",
    quiz_type: "mcq",
    question: "Q1?",
    correct_answer: "A",
    explanation: "",
    options: { A: "a", B: "b", C: "c", D: "d" },
    concept_tags: ["math", "algebra"],
    difficulty: 2,
  },
  {
    id: "q2",
    quiz_type: "true_false",
    question: "Q2?",
    correct_answer: "O",
    explanation: "",
    options: null,
    concept_tags: ["science"],
    difficulty: 1,
  },
];

const result: SubmitResult = {
  attempt_id: "a1",
  attempt_number: 1,
  score: 1,
  total: 2,
  results: [
    {
      quiz_item_id: "q1",
      user_answer: "A",
      correct_answer: "A",
      is_correct: true,
      explanation: "",
    },
    {
      quiz_item_id: "q2",
      user_answer: "X",
      correct_answer: "O",
      is_correct: false,
      explanation: "",
    },
  ],
  wrong_notes_created: 1,
};

describe("QuizResults", () => {
  it("displays score and percentage", () => {
    render(<QuizResults result={result} items={items} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/50% Accuracy/)).toBeInTheDocument();
  });

  it("shows wrong notes created count", () => {
    render(<QuizResults result={result} items={items} />);
    expect(screen.getByText(/1개의 오답노트가 생성되었습니다/)).toBeInTheDocument();
  });

  it("shows attempt number when > 1", () => {
    const retakeResult: SubmitResult = { ...result, attempt_number: 3 };
    render(<QuizResults result={retakeResult} items={items} />);
    expect(screen.getByText(/Attempt #3/)).toBeInTheDocument();
  });

  it("does not show attempt number for first attempt", () => {
    render(<QuizResults result={result} items={items} />);
    expect(screen.queryByText(/Attempt #/)).not.toBeInTheDocument();
  });

  it("hides wrong notes message when all correct", () => {
    const perfectResult: SubmitResult = {
      ...result,
      score: 2,
      results: result.results.map((r) => ({ ...r, is_correct: true })),
      wrong_notes_created: 0,
    };
    render(<QuizResults result={perfectResult} items={items} />);
    expect(screen.queryByText(/오답노트가 생성/)).not.toBeInTheDocument();
  });

  it("shows AI 채점 badge for semantic grading", () => {
    const semanticResult: SubmitResult = {
      ...result,
      results: [
        { ...result.results[0], grading_method: "exact" },
        { ...result.results[1], grading_method: "semantic" },
      ],
    };
    render(<QuizResults result={semanticResult} items={items} />);
    // Q2 is incorrect and in the expanded section, so AI 채점 badge should be visible
    expect(screen.getByText("AI 채점")).toBeInTheDocument();
  });

  it("hides AI 채점 badge for exact grading", () => {
    const exactResult: SubmitResult = {
      ...result,
      results: result.results.map((r) => ({ ...r, grading_method: "exact" as const })),
    };
    render(<QuizResults result={exactResult} items={items} />);
    expect(screen.queryByText("AI 채점")).not.toBeInTheDocument();
  });

  it("shows concept tags on result cards", () => {
    render(<QuizResults result={result} items={items} />);
    // Incorrect section is expanded by default — tags from q2 should be visible
    expect(screen.getByText("science")).toBeInTheDocument();
  });

  it("shows difficulty stars on result cards", () => {
    render(<QuizResults result={result} items={items} />);
    // q2 has difficulty 1: "★☆☆"
    expect(screen.getByText("★☆☆")).toBeInTheDocument();
  });

  it("shows type breakdown when multiple types exist", () => {
    render(<QuizResults result={result} items={items} />);
    expect(screen.getByText("객관식")).toBeInTheDocument();
    expect(screen.getByText("O/X")).toBeInTheDocument();
  });

  it("shows elapsed time when provided", () => {
    render(<QuizResults result={result} items={items} elapsedMs={125000} />);
    expect(screen.getByText(/소요시간: 2분 5초/)).toBeInTheDocument();
  });

  it("hides elapsed time when not provided", () => {
    render(<QuizResults result={result} items={items} />);
    expect(screen.queryByText(/소요시간/)).not.toBeInTheDocument();
  });

  it("shows perfect score message and confetti on 100%", async () => {
    const confettiMod = await import("canvas-confetti");
    const perfectResult: SubmitResult = {
      ...result,
      score: 2,
      results: result.results.map((r) => ({ ...r, is_correct: true })),
      wrong_notes_created: 0,
    };
    render(<QuizResults result={perfectResult} items={items} />);
    expect(screen.getByText("만점! 완벽하게 풀었습니다!")).toBeInTheDocument();
    await waitFor(() => {
      expect(confettiMod.default).toHaveBeenCalled();
    });
  });

  it("toggles incorrect section collapse", async () => {
    render(<QuizResults result={result} items={items} />);
    const toggleBtn = screen.getByRole("button", { name: /틀린 문제/ });
    // Initially expanded — Q2 should be visible
    expect(screen.getByText("Q2?")).toBeInTheDocument();
    await userEvent.click(toggleBtn);
    expect(screen.queryByText("Q2?")).not.toBeInTheDocument();
  });

  it("toggles correct section collapse", async () => {
    render(<QuizResults result={result} items={items} />);
    const toggleBtn = screen.getByRole("button", { name: /맞은 문제/ });
    // Initially collapsed — Q1 should NOT be in the document
    expect(screen.queryByText("Q1?")).not.toBeInTheDocument();
    await userEvent.click(toggleBtn);
    expect(screen.getByText("Q1?")).toBeInTheDocument();
  });
});
