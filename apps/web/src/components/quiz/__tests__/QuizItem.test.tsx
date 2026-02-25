import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizItem } from "../QuizItem";
import type { QuizItem as QuizItemType } from "@/types/api";

const mcqItem: QuizItemType = {
  id: "q1",
  quiz_type: "mcq",
  question: "What is 2+2?",
  options: { A: "4", B: "3", C: "5", D: "6" },
  concept_tags: ["math"],
  difficulty: 1,
};

const shortAnswerItem: QuizItemType = {
  id: "q2",
  quiz_type: "short_answer",
  question: "What is the capital of Korea?",
  options: null,
  concept_tags: ["geography"],
  difficulty: 1,
};

const trueFalseItem: QuizItemType = {
  id: "q3",
  quiz_type: "true_false",
  question: "The earth is flat.",
  options: null,
  concept_tags: ["science"],
  difficulty: 1,
};

describe("QuizItem", () => {
  it("renders MCQ with radio options", () => {
    render(
      <QuizItem item={mcqItem} index={0} value="" onChange={vi.fn()} />,
    );
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
    expect(screen.getByText(/객관식/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("calls onChange when MCQ option selected", async () => {
    const onChange = vi.fn();
    render(
      <QuizItem item={mcqItem} index={0} value="" onChange={onChange} />,
    );
    const radios = screen.getAllByRole("radio");
    await userEvent.click(radios[0]);
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("renders short_answer with textarea", () => {
    render(
      <QuizItem
        item={shortAnswerItem}
        index={1}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/단답형/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("답변을 상세히 입력하세요...")).toBeInTheDocument();
  });

  it("renders true_false with O/X buttons", () => {
    render(
      <QuizItem
        item={trueFalseItem}
        index={2}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("disables radio inputs when disabled prop is true", () => {
    render(
      <QuizItem
        item={mcqItem}
        index={0}
        value="A"
        onChange={vi.fn()}
        disabled
      />,
    );
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio) => {
      expect(radio).toBeDisabled();
    });
  });
});
