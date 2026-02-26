import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import { DocumentCard } from "../DocumentCard";
import type { Document } from "@/types/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/api", () => ({
  deleteDocument: vi.fn(),
  listFolders: vi.fn().mockResolvedValue([]),
  moveDocumentToFolder: vi.fn(),
}));

import { deleteDocument } from "@/lib/api";

const mockDocument: Document = {
  id: "abc-123",
  title: "Introduction to CS",
  source_type: "text",
  char_count: 5000,
  chunk_count: 3,
  quiz_count: 0,
  created_at: "2025-06-01T10:00:00Z",
  folder_id: null,
  folder_name: null,
};

describe("DocumentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it("renders title and metadata", () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    expect(screen.getByText("Introduction to CS")).toBeInTheDocument();
    expect(screen.getByText(/3개/)).toBeInTheDocument();
  });

  it("hides quiz button when onSelect is not provided", () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    expect(screen.queryByText("퀴즈 생성")).not.toBeInTheDocument();
  });

  it("shows quiz button and calls onSelect on click", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DocumentCard document={mockDocument} onSelect={onSelect} />,
    );

    const button = screen.getByText("퀴즈 생성");
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith("abc-123");
  });

  it("shows delete button", () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    expect(screen.getByTitle("삭제")).toBeInTheDocument();
  });

  it("calls deleteDocument after confirm dialog", async () => {
    vi.mocked(deleteDocument).mockResolvedValueOnce(undefined);
    renderWithProviders(<DocumentCard document={mockDocument} />);
    await userEvent.click(screen.getByTitle("삭제"));
    // ConfirmDialog is now shown
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    const confirmBtn = dialog.querySelector("button:last-child") as HTMLButtonElement;
    await userEvent.click(confirmBtn);
    expect(deleteDocument).toHaveBeenCalledWith("abc-123");
  });

  it("does not call deleteDocument when confirm dialog is cancelled", async () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    await userEvent.click(screen.getByTitle("삭제"));
    const dialog = screen.getByRole("alertdialog");
    const cancelBtn = dialog.querySelector("button:first-child") as HTMLButtonElement;
    await userEvent.click(cancelBtn);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("shows quiz count when > 0", () => {
    const docWithQuizzes = { ...mockDocument, quiz_count: 3 };
    renderWithProviders(<DocumentCard document={docWithQuizzes} />);
    expect(screen.getByText(/3개 퀴즈/)).toBeInTheDocument();
  });

  it("hides quiz count when 0", () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    expect(screen.queryByText(/개 퀴즈/)).not.toBeInTheDocument();
  });

  it("navigates to document detail page on card click", async () => {
    renderWithProviders(<DocumentCard document={mockDocument} />);
    await userEvent.click(screen.getByText("Introduction to CS"));
    expect(mockPush).toHaveBeenCalledWith("/documents/abc-123");
  });
});
