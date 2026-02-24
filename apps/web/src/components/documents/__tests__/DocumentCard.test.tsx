import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import { DocumentCard } from "../DocumentCard";
import type { Document } from "@/types/api";

vi.mock("@/lib/api", () => ({
  deleteDocument: vi.fn(),
}));

import { deleteDocument } from "@/lib/api";

const mockDocument: Document = {
  id: "abc-123",
  title: "Introduction to CS",
  source_type: "text",
  char_count: 5000,
  chunk_count: 3,
  created_at: "2025-06-01T10:00:00Z",
};

describe("DocumentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
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
    expect(screen.getByText("삭제")).toBeInTheDocument();
  });

  it("calls deleteDocument after confirm", async () => {
    vi.mocked(deleteDocument).mockResolvedValueOnce(undefined);
    renderWithProviders(<DocumentCard document={mockDocument} />);
    await userEvent.click(screen.getByText("삭제"));
    expect(deleteDocument).toHaveBeenCalledWith("abc-123");
  });

  it("does not call deleteDocument when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithProviders(<DocumentCard document={mockDocument} />);
    await userEvent.click(screen.getByText("삭제"));
    expect(deleteDocument).not.toHaveBeenCalled();
  });
});
