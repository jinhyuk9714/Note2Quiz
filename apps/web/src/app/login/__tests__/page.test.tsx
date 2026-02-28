import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";

const mockReplace = vi.fn();
const mockSetToken = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
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

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ setToken: mockSetToken }),
}));

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
}));

import { login } from "@/lib/api";

describe("LoginPage", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText("이메일 주소")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("renders submit button with 시작하기", () => {
    renderWithProviders(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /시작하기/i }),
    ).toBeInTheDocument();
  });

  it("renders signup link", () => {
    renderWithProviders(<LoginPage />);
    const link = screen.getByText("지금 가입하기");
    expect(link.closest("a")).toHaveAttribute("href", "/signup");
  });

  it("calls login API with email and password on submit", async () => {
    vi.mocked(login).mockResolvedValueOnce({ access_token: "tok123", refresh_token: "ref123", token_type: "bearer" });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("이메일 주소"), "test@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /시작하기/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });
  });

  it("calls setToken and router.replace on success", async () => {
    vi.mocked(login).mockResolvedValueOnce({ access_token: "tok123", refresh_token: "ref123", token_type: "bearer" });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("이메일 주소"), "test@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /시작하기/i }));

    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith("tok123");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("displays error message on login failure", async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error("잘못된 이메일 또는 비밀번호"));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("이메일 주소"), "bad@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "wrong");
    await user.click(screen.getByRole("button", { name: /시작하기/i }));

    await waitFor(() => {
      expect(screen.getByText("잘못된 이메일 또는 비밀번호")).toBeInTheDocument();
    });
  });

  it("shows loading text while submitting", async () => {
    let resolveLogin: (value: { access_token: string; refresh_token: string; token_type: string }) => void;
    vi.mocked(login).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("이메일 주소"), "test@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /시작하기/i }));

    expect(screen.getByText("로그인 중...")).toBeInTheDocument();

    resolveLogin!({ access_token: "tok", refresh_token: "ref", token_type: "bearer" });
    await waitFor(() => {
      expect(screen.getByText(/시작하기/)).toBeInTheDocument();
    });
  });
});
