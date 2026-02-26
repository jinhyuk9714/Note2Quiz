import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { QuizItemCreateForm } from "../QuizItemCreateForm";

vi.mock("@/lib/api", () => ({
  createQuizItem: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { createQuizItem } from "@/lib/api";

describe("QuizItemCreateForm", () => {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form title", () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    expect(screen.getByText("새 문항 추가")).toBeInTheDocument();
  });

  it("renders quiz type options", () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    expect(screen.getByText("객관식")).toBeInTheDocument();
    expect(screen.getByText("단답형")).toBeInTheDocument();
    expect(screen.getByText("O/X")).toBeInTheDocument();
    expect(screen.getByText("빈칸 채우기")).toBeInTheDocument();
  });

  it("save button is disabled when fields are empty", () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    const saveBtn = screen.getByText("추가").closest("button")!;
    expect(saveBtn).toBeDisabled();
  });

  it("save button is enabled when required fields are filled", async () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );

    await user.type(screen.getByPlaceholderText("문제를 입력하세요"), "테스트 문제");
    await user.type(screen.getByPlaceholderText("정답을 입력하세요"), "정답");
    await user.type(screen.getByPlaceholderText("해설을 입력하세요"), "해설");

    const saveBtn = screen.getByText("추가").closest("button")!;
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls onCancel when cancel button clicked", async () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows MCQ options when 객관식 is selected", async () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("객관식"));

    expect(screen.getByPlaceholderText("보기 A")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("보기 B")).toBeInTheDocument();
  });

  it("shows O/X buttons when O/X type is selected", async () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("O/X"));

    const oButton = screen.getByRole("button", { name: "O" });
    const xButton = screen.getByRole("button", { name: "X" });
    expect(oButton).toBeInTheDocument();
    expect(xButton).toBeInTheDocument();
  });

  it("submits form with correct data", async () => {
    vi.mocked(createQuizItem).mockResolvedValueOnce({} as never);

    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );

    await user.type(screen.getByPlaceholderText("문제를 입력하세요"), "What is 1+1?");
    await user.type(screen.getByPlaceholderText("정답을 입력하세요"), "2");
    await user.type(screen.getByPlaceholderText("해설을 입력하세요"), "Basic math");

    await user.click(screen.getByText("추가").closest("button")!);

    await waitFor(() => {
      expect(createQuizItem).toHaveBeenCalledWith("q1", expect.objectContaining({
        quiz_type: "short_answer",
        question: "What is 1+1?",
        correct_answer: "2",
        explanation: "Basic math",
      }));
    });
  });

  it("shows 보기 추가 button for MCQ and can add option", async () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("객관식"));
    await user.click(screen.getByText("보기 추가"));

    expect(screen.getByPlaceholderText("보기 C")).toBeInTheDocument();
  });

  it("renders difficulty stars", () => {
    renderWithProviders(
      <QuizItemCreateForm quizId="q1" onCreated={onCreated} onCancel={onCancel} />,
    );
    const stars = screen.getAllByText("★");
    expect(stars.length).toBe(5);
  });
});
