import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentCard } from "../DocumentCard";
import type { Document } from "@/types/api";

const mockDocument: Document = {
  id: "abc-123",
  title: "Introduction to CS",
  source_type: "text",
  char_count: 5000,
  chunk_count: 3,
  created_at: "2025-06-01T10:00:00Z",
};

describe("DocumentCard", () => {
  it("renders title and metadata", () => {
    render(<DocumentCard document={mockDocument} />);
    expect(screen.getByText("Introduction to CS")).toBeInTheDocument();
    expect(screen.getByText(/3개/)).toBeInTheDocument();
  });

  it("hides quiz button when onSelect is not provided", () => {
    render(<DocumentCard document={mockDocument} />);
    expect(screen.queryByText("퀴즈 생성")).not.toBeInTheDocument();
  });

  it("shows quiz button and calls onSelect on click", async () => {
    const onSelect = vi.fn();
    render(<DocumentCard document={mockDocument} onSelect={onSelect} />);

    const button = screen.getByText("퀴즈 생성");
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith("abc-123");
  });
});
