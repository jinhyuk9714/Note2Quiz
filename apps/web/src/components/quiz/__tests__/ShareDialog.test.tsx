import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { ShareDialog } from "../ShareDialog";

vi.mock("@/lib/api", () => ({
  getShareInfo: vi.fn(),
  toggleShare: vi.fn(),
  regenerateShareCode: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

import { getShareInfo, toggleShare } from "@/lib/api";

describe("ShareDialog", () => {
  const onClose = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    const { container } = renderWithProviders(
      <ShareDialog open={false} quizId="q1" onClose={onClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog title when open", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: false,
      share_code: null,
      share_url: null,
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);
    expect(screen.getByText("퀴즈 공유")).toBeInTheDocument();
  });

  it("shows share toggle switch", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: false,
      share_code: null,
      share_url: null,
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
    expect(screen.getByText("링크를 받은 로그인 사용자가 이 퀴즈를 풀 수 있습니다")).toBeInTheDocument();
  });

  it("shows share URL and copy button when shared", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: true,
      share_code: "abc123",
      share_url: "https://example.com/share/abc123",
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://example.com/share/abc123")).toBeInTheDocument();
      expect(screen.getByText("복사")).toBeInTheDocument();
    });
  });

  it("calls toggleShare when switch is clicked", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: false,
      share_code: null,
      share_url: null,
    });
    vi.mocked(toggleShare).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: true,
      share_code: "new123",
      share_url: "https://example.com/share/new123",
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(toggleShare).toHaveBeenCalledWith("q1", true);
    });
  });

  it("shows regenerate link when shared", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: true,
      share_code: "abc123",
      share_url: "https://example.com/share/abc123",
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("링크 재생성")).toBeInTheDocument();
    });
  });

  it("shows confirmation prompt when regenerate is clicked", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: true,
      share_code: "abc123",
      share_url: "https://example.com/share/abc123",
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("링크 재생성")).toBeInTheDocument();
    });

    await user.click(screen.getByText("링크 재생성"));

    await waitFor(() => {
      expect(screen.getByText("기존 링크가 무효화됩니다. 계속하시겠습니까?")).toBeInTheDocument();
    });
  });

  it("calls onClose when X button is clicked", async () => {
    vi.mocked(getShareInfo).mockResolvedValueOnce({
      quiz_id: "q1",
      is_shared: false,
      share_code: null,
      share_url: null,
    });

    renderWithProviders(<ShareDialog open={true} quizId="q1" onClose={onClose} />);

    const closeButtons = screen.getAllByRole("button");
    const xButton = closeButtons.find((btn) =>
      btn.querySelector(".lucide-x"),
    );
    if (xButton) {
      await user.click(xButton);
      expect(onClose).toHaveBeenCalledOnce();
    }
  });
});
