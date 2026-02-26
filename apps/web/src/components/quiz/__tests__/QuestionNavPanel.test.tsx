import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionNavPanel } from "../QuestionNavPanel";
import type { QuizItem } from "@/types/api";

function makeItems(n: number): QuizItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i + 1}`,
    quiz_type: "short_answer" as const,
    question: `Q${i + 1}`,
    options: null,
    concept_tags: [],
    difficulty: 1,
  }));
}

describe("QuestionNavPanel", () => {
  const user = userEvent.setup();

  it("renders numbered buttons for each item", () => {
    render(
      <QuestionNavPanel
        items={makeItems(3)}
        answers={{}}
        skippedIds={new Set()}
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows answered count", () => {
    render(
      <QuestionNavPanel
        items={makeItems(3)}
        answers={{ "item-1": "A", "item-3": "C" }}
        skippedIds={new Set()}
      />,
    );
    expect(screen.getByText(/답변 2/)).toBeInTheDocument();
  });

  it("shows skipped count", () => {
    render(
      <QuestionNavPanel
        items={makeItems(3)}
        answers={{}}
        skippedIds={new Set(["item-2"])}
      />,
    );
    expect(screen.getByText(/건너뜀 1/)).toBeInTheDocument();
  });

  it("does not show skipped label when count is zero", () => {
    render(
      <QuestionNavPanel
        items={makeItems(3)}
        answers={{}}
        skippedIds={new Set()}
      />,
    );
    expect(screen.queryByText(/건너뜀/)).not.toBeInTheDocument();
  });

  it("answered button has indigo style", () => {
    render(
      <QuestionNavPanel
        items={makeItems(2)}
        answers={{ "item-1": "A" }}
        skippedIds={new Set()}
      />,
    );
    const btn = screen.getByTitle("1번 (답변완료)");
    expect(btn.className).toContain("indigo");
  });

  it("skipped button has amber style", () => {
    render(
      <QuestionNavPanel
        items={makeItems(2)}
        answers={{}}
        skippedIds={new Set(["item-1"])}
      />,
    );
    const btn = screen.getByTitle("1번 (건너뜀)");
    expect(btn.className).toContain("amber");
  });

  it("calls onNavigate with correct index on click", async () => {
    const onNavigate = vi.fn();
    render(
      <QuestionNavPanel
        items={makeItems(3)}
        answers={{}}
        skippedIds={new Set()}
        onNavigate={onNavigate}
      />,
    );
    await user.click(screen.getByText("2"));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("shows helper text when items > 10", () => {
    render(
      <QuestionNavPanel
        items={makeItems(11)}
        answers={{}}
        skippedIds={new Set()}
      />,
    );
    expect(screen.getByText(/번호를 클릭하면/)).toBeInTheDocument();
  });
});
