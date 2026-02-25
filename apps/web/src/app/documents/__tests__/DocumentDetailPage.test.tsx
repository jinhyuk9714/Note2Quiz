import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import DocumentDetailPage from "../[id]/page";
import type { DocumentDetail, QuizListItem } from "@/types/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "doc-1" }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockGetDocument = vi.fn();
const mockListQuizzes = vi.fn();
const mockDeleteDocument = vi.fn();
const mockUpdateDocument = vi.fn();

vi.mock("@/lib/api", () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  listQuizzes: (...args: unknown[]) => mockListQuizzes(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

const doc: DocumentDetail = {
  id: "doc-1",
  title: "Introduction to Algorithms",
  source_type: "pdf",
  char_count: 12000,
  chunk_count: 3,
  quiz_count: 1,
  created_at: "2025-06-10T08:00:00Z",
  chunks: [
    { id: "c1", index: 0, content: "Chunk one content", token_count: 80 },
    { id: "c2", index: 1, content: "Chunk two content", token_count: 90 },
    { id: "c3", index: 2, content: "Chunk three content", token_count: 70 },
  ],
};

const quizzes: QuizListItem[] = [
  {
    id: "q1",
    title: "Algorithms Quiz 1",
    item_count: 5,
    document_id: "doc-1",
    document_title: "Introduction to Algorithms",
    created_at: "2025-06-11T10:00:00Z",
    attempt_count: 1,
    latest_score: 4,
    latest_total: 5,
  },
];

describe("DocumentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockResolvedValue(doc);
    mockListQuizzes.mockResolvedValue({ items: quizzes, total: 1 });
  });

  it("renders document title and metadata", async () => {
    renderWithProviders(<DocumentDetailPage />);
    expect(
      await screen.findByText("Introduction to Algorithms"),
    ).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getAllByText("3개 섹션").length).toBeGreaterThanOrEqual(1);
  });

  it("renders back link to documents list", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    const backLink = screen.getByText("Back to Documents").closest("a");
    expect(backLink).toHaveAttribute("href", "/documents");
  });

  it("renders chunk viewer with chunks", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    expect(screen.getByText("문서 내용")).toBeInTheDocument();
    // Chunk indices
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders related quizzes section", async () => {
    renderWithProviders(<DocumentDetailPage />);
    expect(await screen.findByText("관련 퀴즈")).toBeInTheDocument();
    expect(
      await screen.findByText("Algorithms Quiz 1"),
    ).toBeInTheDocument();
  });

  it("shows quiz generation link", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    const links = screen.getAllByText("퀴즈 생성");
    expect(links.length).toBeGreaterThan(0);
    const quizGenLink = links[0]!.closest("a");
    expect(quizGenLink).toHaveAttribute(
      "href",
      "/quiz/generate?document_id=doc-1",
    );
  });

  it("shows empty quiz state when no quizzes", async () => {
    mockListQuizzes.mockResolvedValue({ items: [], total: 0 });
    renderWithProviders(<DocumentDetailPage />);
    expect(
      await screen.findByText("아직 생성된 퀴즈가 없습니다"),
    ).toBeInTheDocument();
  });

  it("shows error state when document not found", async () => {
    mockGetDocument.mockRejectedValue(new Error("Not found"));
    renderWithProviders(<DocumentDetailPage />);
    expect(
      await screen.findByText("문서를 찾을 수 없습니다"),
    ).toBeInTheDocument();
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockGetDocument.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DocumentDetailPage />);
    expect(screen.getByText("문서를 불러오는 중...")).toBeInTheDocument();
  });

  it("shows edit button on hover and switches to input on click", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    const editBtn = screen.getByTitle("이름 변경");
    await userEvent.click(editBtn);
    const input = screen.getByDisplayValue("Introduction to Algorithms");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("calls updateDocument on Enter key", async () => {
    mockUpdateDocument.mockResolvedValueOnce({ ...doc, title: "New Title" });
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    await userEvent.click(screen.getByTitle("이름 변경"));
    const input = screen.getByDisplayValue("Introduction to Algorithms");
    await userEvent.clear(input);
    await userEvent.type(input, "New Title{Enter}");
    expect(mockUpdateDocument).toHaveBeenCalledWith("doc-1", { title: "New Title" });
  });

  it("cancels editing on Escape key", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    await userEvent.click(screen.getByTitle("이름 변경"));
    expect(screen.getByDisplayValue("Introduction to Algorithms")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByDisplayValue("Introduction to Algorithms")).not.toBeInTheDocument();
    // Title should be visible again as h1
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Introduction to Algorithms");
  });

  it("does not call updateDocument when title is unchanged", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    await userEvent.click(screen.getByTitle("이름 변경"));
    await userEvent.keyboard("{Enter}");
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it("does not call updateDocument when title is empty", async () => {
    renderWithProviders(<DocumentDetailPage />);
    await screen.findByText("Introduction to Algorithms");
    await userEvent.click(screen.getByTitle("이름 변경"));
    const input = screen.getByDisplayValue("Introduction to Algorithms");
    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });
});
