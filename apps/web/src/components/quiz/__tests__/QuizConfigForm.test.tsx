import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizConfigForm } from "../QuizConfigForm";

describe("QuizConfigForm", () => {
  it("pre-fills document ID from prop", () => {
    render(
      <QuizConfigForm
        defaultDocumentId="abc-123"
        onSubmit={vi.fn()}
        isPending={false}
      />,
    );
    const input = screen.getByLabelText("문서 ID") as HTMLInputElement;
    expect(input.value).toBe("abc-123");
  });

  it("disables submit when no document ID", () => {
    render(
      <QuizConfigForm onSubmit={vi.fn()} isPending={false} />,
    );
    expect(screen.getByRole("button", { name: "퀴즈 생성" })).toBeDisabled();
  });

  it('shows "생성 중..." when pending', () => {
    render(
      <QuizConfigForm
        defaultDocumentId="x"
        onSubmit={vi.fn()}
        isPending={true}
      />,
    );
    expect(
      screen.getByRole("button", { name: "생성 중..." }),
    ).toBeDisabled();
  });

  it("calls onSubmit with config", async () => {
    const onSubmit = vi.fn();
    render(
      <QuizConfigForm
        defaultDocumentId="doc-1"
        onSubmit={onSubmit}
        isPending={false}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "퀴즈 생성" }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        quizTypes: expect.arrayContaining(["mcq", "short_answer"]),
      }),
    );
  });
});
