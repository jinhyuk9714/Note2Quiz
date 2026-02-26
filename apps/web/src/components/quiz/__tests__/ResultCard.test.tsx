import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultCard, type ResultCardData } from "../ResultCard";

function makeData(overrides: Partial<ResultCardData> = {}): ResultCardData {
  return {
    quiz_item_id: "qi-1",
    question: "What is 1+1?",
    user_answer: "2",
    correct_answer: "2",
    is_correct: true,
    explanation: "Basic arithmetic.",
    grading_method: null,
    concept_tags: [],
    difficulty: 0,
    ...overrides,
  };
}

describe("ResultCard", () => {
  it("renders question number and text", () => {
    render(<ResultCard data={makeData()} index={3} />);
    expect(screen.getByText("Q3.")).toBeInTheDocument();
    expect(screen.getByText("What is 1+1?")).toBeInTheDocument();
  });

  it("shows user answer", () => {
    render(<ResultCard data={makeData({ user_answer: "Option A" })} index={1} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("shows (No Answer) when user_answer is empty", () => {
    render(<ResultCard data={makeData({ user_answer: "" })} index={1} />);
    expect(screen.getByText("(No Answer)")).toBeInTheDocument();
  });

  it("does not show correct answer section when is_correct is true", () => {
    render(<ResultCard data={makeData({ is_correct: true })} index={1} />);
    expect(screen.queryByText("Correct Answer")).not.toBeInTheDocument();
  });

  it("shows correct answer section when is_correct is false", () => {
    render(
      <ResultCard
        data={makeData({
          is_correct: false,
          user_answer: "3",
          correct_answer: "2",
        })}
        index={1}
      />,
    );
    expect(screen.getByText("Correct Answer")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders explanation section", () => {
    render(<ResultCard data={makeData({ explanation: "This is why." })} index={1} />);
    expect(screen.getByText("This is why.")).toBeInTheDocument();
    expect(screen.getByText("해설:")).toBeInTheDocument();
  });

  it("hides explanation when empty", () => {
    render(<ResultCard data={makeData({ explanation: "" })} index={1} />);
    expect(screen.queryByText("해설:")).not.toBeInTheDocument();
  });

  it("renders concept tags", () => {
    render(
      <ResultCard
        data={makeData({ concept_tags: ["Math", "Algebra"] })}
        index={1}
      />,
    );
    expect(screen.getByText("Math")).toBeInTheDocument();
    expect(screen.getByText("Algebra")).toBeInTheDocument();
  });

  it("renders difficulty stars", () => {
    render(<ResultCard data={makeData({ difficulty: 2 })} index={1} />);
    expect(screen.getByText("★★☆")).toBeInTheDocument();
  });

  it("renders AI 채점 badge when grading_method is semantic", () => {
    render(
      <ResultCard
        data={makeData({ grading_method: "semantic" })}
        index={1}
      />,
    );
    expect(screen.getByText("AI 채점")).toBeInTheDocument();
  });

  it("does not render AI 채점 badge when grading_method is not semantic", () => {
    render(
      <ResultCard
        data={makeData({ grading_method: "exact" })}
        index={1}
      />,
    );
    expect(screen.queryByText("AI 채점")).not.toBeInTheDocument();
  });
});
