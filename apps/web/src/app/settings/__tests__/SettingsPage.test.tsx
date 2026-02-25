import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import SettingsPage from "../page";

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
const mockLogout = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", display_name: "Test User" },
    refreshUser: mockRefreshUser,
    logout: mockLogout,
  }),
}));

vi.mock("@/lib/api", () => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  clearToken: vi.fn(),
}));

import { updateProfile, changePassword, deleteAccount } from "@/lib/api";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three sections", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("프로필 정보")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "비밀번호 변경" })).toBeInTheDocument();
    expect(screen.getByText("위험 구역")).toBeInTheDocument();
  });

  it("shows email as read-only", () => {
    renderWithProviders(<SettingsPage />);
    const emailInput = screen.getByDisplayValue("test@example.com");
    expect(emailInput).toBeDisabled();
  });

  it("pre-fills display name", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });

  it("disables profile save when name is unchanged", () => {
    renderWithProviders(<SettingsPage />);
    const saveBtn = screen.getByText("프로필 저장");
    expect(saveBtn).toBeDisabled();
  });

  it("calls updateProfile on save", async () => {
    vi.mocked(updateProfile).mockResolvedValueOnce({
      id: "u1",
      email: "test@example.com",
      display_name: "New Name",
    });
    renderWithProviders(<SettingsPage />);

    const nameInput = screen.getByDisplayValue("Test User");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "New Name");
    await userEvent.click(screen.getByText("프로필 저장"));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        display_name: "New Name",
      });
    });
  });

  it("shows password mismatch error", async () => {
    renderWithProviders(<SettingsPage />);

    await userEvent.type(screen.getByLabelText("새 비밀번호"), "newpassword1");
    await userEvent.type(
      screen.getByLabelText("새 비밀번호 확인"),
      "different",
    );

    expect(
      screen.getByText("비밀번호가 일치하지 않습니다."),
    ).toBeInTheDocument();
  });

  it("calls changePassword on submit", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce(undefined);
    renderWithProviders(<SettingsPage />);

    await userEvent.type(screen.getByLabelText("현재 비밀번호"), "oldpass123");
    await userEvent.type(screen.getByLabelText("새 비밀번호"), "newpass456");
    await userEvent.type(
      screen.getByLabelText("새 비밀번호 확인"),
      "newpass456",
    );
    await userEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        current_password: "oldpass123",
        new_password: "newpass456",
      });
    });
  });

  it("shows delete confirmation flow and calls deleteAccount", async () => {
    vi.mocked(deleteAccount).mockResolvedValueOnce(undefined);
    renderWithProviders(<SettingsPage />);

    // Initially no password input
    expect(
      screen.queryByLabelText("비밀번호를 입력하세요"),
    ).not.toBeInTheDocument();

    // Click delete button to show confirmation
    await userEvent.click(screen.getByText("계정 삭제"));

    // Now password input should appear
    const pwInput = screen.getByLabelText("비밀번호를 입력하세요");
    expect(pwInput).toBeInTheDocument();

    await userEvent.type(pwInput, "mypassword");
    await userEvent.click(screen.getByText("영구 삭제"));

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith({
        password: "mypassword",
      });
    });
  });

  it("hides delete confirmation on cancel", async () => {
    renderWithProviders(<SettingsPage />);

    await userEvent.click(screen.getByText("계정 삭제"));
    expect(
      screen.getByLabelText("비밀번호를 입력하세요"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText("취소"));
    expect(
      screen.queryByLabelText("비밀번호를 입력하세요"),
    ).not.toBeInTheDocument();
  });
});
