import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { DocumentUploadForm } from "../DocumentUploadForm";

vi.mock("@/lib/api", () => ({
  uploadDocument: vi.fn(),
}));

import { uploadDocument } from "@/lib/api";

describe("DocumentUploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form elements", () => {
    renderWithProviders(<DocumentUploadForm />);
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
    expect(screen.getByLabelText("텍스트")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "업로드" })).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    renderWithProviders(<DocumentUploadForm />);
    const button = screen.getByRole("button", { name: "업로드" });
    expect(button).toBeDisabled();
  });

  it("disables submit when text is too short", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("제목"), "Title");
    await userEvent.type(screen.getByLabelText("텍스트"), "short");
    expect(screen.getByRole("button", { name: "업로드" })).toBeDisabled();
  });

  it("enables submit when both fields are valid", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("제목"), "Title");
    await userEvent.type(
      screen.getByLabelText("텍스트"),
      "This is definitely longer than ten characters.",
    );
    expect(screen.getByRole("button", { name: "업로드" })).toBeEnabled();
  });

  it("shows character count", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("텍스트"), "Hello");
    expect(screen.getByText("5자")).toBeInTheDocument();
  });

  it("calls uploadDocument on submit and shows success", async () => {
    const mockUpload = vi.mocked(uploadDocument);
    mockUpload.mockResolvedValueOnce({
      id: "new-id",
      title: "Title",
      source_type: "text",
      char_count: 100,
      chunk_count: 2,
      created_at: "2025-01-01T00:00:00Z",
    });

    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("제목"), "Title");
    await userEvent.type(
      screen.getByLabelText("텍스트"),
      "This is definitely longer than ten characters.",
    );
    await userEvent.click(screen.getByRole("button", { name: "업로드" }));

    await waitFor(() => {
      expect(screen.getByText(/업로드 완료/)).toBeInTheDocument();
    });
  });
});
