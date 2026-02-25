import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { DocumentUploadForm } from "../DocumentUploadForm";

vi.mock("@/lib/api", () => ({
  uploadDocument: vi.fn(),
  uploadDocumentFile: vi.fn(),
}));

import { uploadDocument } from "@/lib/api";

describe("DocumentUploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form elements with mode tabs", () => {
    renderWithProviders(<DocumentUploadForm />);
    expect(screen.getByLabelText("문서 제목")).toBeInTheDocument();
    expect(screen.getByText("텍스트 붙여넣기")).toBeInTheDocument();
    expect(screen.getByText("PDF 업로드")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /업로드 및 분석/ })).toBeInTheDocument();
  });

  it("defaults to text mode with textarea visible", () => {
    renderWithProviders(<DocumentUploadForm />);
    expect(screen.getByLabelText("학습 자료 본문")).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    renderWithProviders(<DocumentUploadForm />);
    const button = screen.getByRole("button", { name: /업로드 및 분석/ });
    expect(button).toBeDisabled();
  });

  it("disables submit when text is too short", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("문서 제목"), "Title");
    await userEvent.type(screen.getByLabelText("학습 자료 본문"), "short");
    expect(screen.getByRole("button", { name: /업로드 및 분석/ })).toBeDisabled();
  });

  it("enables submit when both fields are valid", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("문서 제목"), "Title");
    await userEvent.type(
      screen.getByLabelText("학습 자료 본문"),
      "This is definitely longer than ten characters.",
    );
    expect(screen.getByRole("button", { name: /업로드 및 분석/ })).toBeEnabled();
  });

  it("shows character count", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("학습 자료 본문"), "Hello");
    expect(screen.getByText(/5 characters/)).toBeInTheDocument();
  });

  it("calls uploadDocument on submit and shows success", async () => {
    const mockUpload = vi.mocked(uploadDocument);
    mockUpload.mockResolvedValueOnce({
      id: "new-id",
      title: "Title",
      source_type: "text",
      char_count: 100,
      chunk_count: 2,
      quiz_count: 0,
      created_at: "2025-01-01T00:00:00Z",
    });

    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("문서 제목"), "Title");
    await userEvent.type(
      screen.getByLabelText("학습 자료 본문"),
      "This is definitely longer than ten characters.",
    );
    await userEvent.click(screen.getByRole("button", { name: /업로드 및 분석/ }));

    await waitFor(() => {
      expect(screen.getByText(/업로드 완료/)).toBeInTheDocument();
    });
  });

  it("switches to PDF mode and hides textarea", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.click(screen.getByText("PDF 업로드"));
    expect(
      screen.getByText(/PDF 파일을 드래그하거나 선택하세요/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("학습 자료 본문")).not.toBeInTheDocument();
  });

  it("disables submit in PDF mode without file", async () => {
    renderWithProviders(<DocumentUploadForm />);
    await userEvent.type(screen.getByLabelText("문서 제목"), "PDF Title");
    await userEvent.click(screen.getByText("PDF 업로드"));
    expect(screen.getByRole("button", { name: /업로드 및 분석/ })).toBeDisabled();
  });
});
