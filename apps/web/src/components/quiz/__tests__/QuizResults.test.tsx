import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuizResults } from "../QuizResults";
import type { SubmitResult, QuizItem } from "@/types/api";

const items: QuizItem[] = [
  {
    id: "q1",
    quiz_type: "mcq",
    question: "Q1?",
    correct_answer: "A",
    explanation: "",
    options: { A: "a", B: "b", C: "c", D: "d" },
    concept_tags: [],
    difficulty: 1,
  },
  {
    id: "q2",
    quiz_type: "mcq",
    question: "Q2?",
    correct_answer: "B",
    explanation: "",
    options: { A: "a", B: "b", C: "c", D: "d" },
    concept_tags: [],
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
      user_answer: "C",
      correct_answer: "B",
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
        { ...result.results[0], grading_method: "semantic" },
        { ...result.results[1], grading_method: "exact" },
      ],
    };
    render(<QuizResults result={semanticResult} items={items} />);
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
});
