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

const MOCK_CHUNKS = [
  { id: "chunk-1", index: 0, content: "Introduction to machine learning concepts and basics", token_count: 120 },
  { id: "chunk-2", index: 1, content: "Supervised learning algorithms and their applications", token_count: 150 },
  { id: "chunk-3", index: 2, content: "Unsupervised learning clustering and dimensionality reduction", token_count: 130 },
];

vi.mock("@/lib/api", () => ({
  listDocuments: vi.fn(() =>
    Promise.resolve({ items: MOCK_DOCUMENTS, total: 2, limit: 100, offset: 0 }),
  ),
  getDocument: vi.fn(() =>
    Promise.resolve({ ...MOCK_DOCUMENTS[0], chunks: MOCK_CHUNKS }),
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

  // Chunk selection tests
  it("shows chunk selection toggle after document is selected", async () => {
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("범위 선택")).toBeInTheDocument();
    });
  });

  it("does not show chunk selection when no document selected", async () => {
    renderWithProviders(
      <QuizConfigForm onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("학습 문서 선택")).toBeInTheDocument();
    });
    expect(screen.queryByText("범위 선택")).not.toBeInTheDocument();
  });

  it("shows chunk list when section is expanded", async () => {
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("범위 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("범위 선택"));
    await waitFor(() => {
      expect(screen.getByText(/Introduction to machine learning/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Supervised learning/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupervised learning/)).toBeInTheDocument();
  });

  it("toggles chunk checkbox selection", async () => {
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("범위 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("범위 선택"));
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
    expect(screen.getByText("1/3개 섹션 선택됨")).toBeInTheDocument();
  });

  it("select all and deselect all buttons work", async () => {
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={vi.fn()} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("범위 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("범위 선택"));
    await waitFor(() => {
      expect(screen.getByText("전체 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("전체 선택"));
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
    expect(screen.getByText("3/3개 섹션 선택됨")).toBeInTheDocument();

    await userEvent.click(screen.getByText("전체 해제"));
    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());
  });

  it("passes chunkIds when chunks are selected", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={onSubmit} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText("범위 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("범위 선택"));
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[2]);

    await userEvent.click(screen.getByRole("button", { name: /퀴즈 생성/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "abc-123",
        chunkIds: expect.arrayContaining(["chunk-1", "chunk-3"]) as string[],
      }),
    );
  });

  it("does not pass chunkIds when no chunks selected", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <QuizConfigForm defaultDocumentId="abc-123" onSubmit={onSubmit} isPending={false} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("학습 문서 선택")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /퀴즈 생성/ }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "abc-123",
      }),
    );
    expect(onSubmit.mock.calls[0][0].chunkIds).toBeUndefined();
  });
});
