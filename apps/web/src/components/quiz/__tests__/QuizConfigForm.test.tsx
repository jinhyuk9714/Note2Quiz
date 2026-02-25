import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { QuizConfigForm } from "../QuizConfigForm";

const MOCK_DOCUMENTS = [
  {
    id: "abc-123",
    title: "Test Document",
    source_type: "text",
    char_count: 1000,
    chunk_count: 5,
    quiz_count: 0,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "def-456",
    title: "Another Doc",
    source_type: "pdf",
    char_count: 2500,
    chunk_count: 10,
    quiz_count: 2,
    created_at: "2025-01-02T00:00:00Z",
  },
];

vi.mock("@/lib/api", () => ({
  listDocuments: vi.fn(() =>
    Promise.resolve({ items: MOCK_DOCUMENTS, total: 2, limit: 100, offset: 0 }),
  ),
}));

describe("QuizConfigForm", () => {
  it("renders document select dropdown", async () => {
    renderWithProviders(
      <QuizConfigForm onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("학습 문서 선택")).toBeInTheDocument();
    });
    const select = screen.getByLabelText("학습 문서 선택") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
  });

  it("shows documents in dropdown options", async () => {
    renderWithProviders(
      <QuizConfigForm onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Test Document/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Another Doc/)).toBeInTheDocument();
  });

  it("pre-selects document from prop", async () => {
    renderWithProviders(
      <QuizConfigForm
        defaultDocumentId="abc-123"
        onSubmit={vi.fn()}
        isPending={false}
      />,
    );
    await waitFor(() => {
      const select = screen.getByLabelText("학습 문서 선택") as HTMLSelectElement;
      expect(select.value).toBe("abc-123");
    });
  });

  it("disables submit when no document selected", async () => {
    renderWithProviders(
      <QuizConfigForm onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("학습 문서 선택")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /퀴즈 생성/ })).toBeDisabled();
  });

  it("disables submit button when pending", async () => {
    const { container } = renderWithProviders(
      <QuizConfigForm
        defaultDocumentId="abc-123"
        onSubmit={vi.fn()}
        isPending={true}
      />,
    );
    await waitFor(() => {
      const submitBtn = container.querySelector('button[type="submit"]');
      expect(submitBtn).toBeDisabled();
    });
  });

  it("calls onSubmit with selected document", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <QuizConfigForm onSubmit={onSubmit} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("학습 문서 선택")).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText("학습 문서 선택"), "def-456");
    await userEvent.click(
      screen.getByRole("button", { name: /퀴즈 생성/ }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "def-456",
        title: "",
        quizTypes: expect.arrayContaining(["mcq", "short_answer"]) as string[],
      }),
    );
  });
});
