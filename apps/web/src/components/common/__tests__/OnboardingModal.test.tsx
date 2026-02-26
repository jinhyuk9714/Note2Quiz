import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingModal } from "../OnboardingModal";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

describe("OnboardingModal", () => {
  const onDismiss = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <OnboardingModal open={false} onDismiss={onDismiss} userName="홍길동" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders welcome message with user name", () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    expect(screen.getByText("홍길동님, 환영합니다!")).toBeInTheDocument();
  });

  it("renders all 3 steps", () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    expect(screen.getByText("문서 업로드")).toBeInTheDocument();
    expect(screen.getByText("AI 퀴즈 생성")).toBeInTheDocument();
    expect(screen.getByText("오답노트 복습")).toBeInTheDocument();
  });

  it("calls onDismiss when 나중에 보기 clicked", async () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    await user.click(screen.getByText("나중에 보기"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("navigates to /documents and dismisses when 시작하기 clicked", async () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    await user.click(screen.getByText("시작하기"));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/documents");
  });

  it("calls onDismiss on Escape key", async () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    await user.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has dialog role with aria-modal", () => {
    render(<OnboardingModal open={true} onDismiss={onDismiss} userName="홍길동" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
