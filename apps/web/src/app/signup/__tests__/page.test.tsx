import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import SignupPage from "../page";

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
  signup: vi.fn(),
}));

import { signup } from "@/lib/api";

describe("SignupPage", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders display name, email, and password inputs", () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByLabelText("사용자 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("이메일 주소")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("renders submit button with 회원가입", () => {
    renderWithProviders(<SignupPage />);
    expect(
      screen.getByRole("button", { name: /회원가입/i }),
    ).toBeInTheDocument();
  });

  it("renders login link", () => {
    renderWithProviders(<SignupPage />);
    const link = screen.getByText("로그인하기");
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });

  it("calls signup API with correct fields on submit", async () => {
    vi.mocked(signup).mockResolvedValueOnce({ access_token: "tok456", refresh_token: "ref456", token_type: "bearer" });
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText("사용자 이름"), "홍길동");
    await user.type(screen.getByLabelText("이메일 주소"), "hong@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith({
        email: "hong@test.com",
        display_name: "홍길동",
        password: "password123",
      });
    });
  });

  it("calls setToken and router.replace on success", async () => {
    vi.mocked(signup).mockResolvedValueOnce({ access_token: "tok456", refresh_token: "ref456", token_type: "bearer" });
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText("사용자 이름"), "홍길동");
    await user.type(screen.getByLabelText("이메일 주소"), "hong@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(mockSetToken).toHaveBeenCalledWith("tok456");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("displays error message on signup failure", async () => {
    vi.mocked(signup).mockRejectedValueOnce(new Error("이미 등록된 이메일입니다."));
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText("사용자 이름"), "홍길동");
    await user.type(screen.getByLabelText("이메일 주소"), "existing@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    await waitFor(() => {
      expect(screen.getByText("이미 등록된 이메일입니다.")).toBeInTheDocument();
    });
  });

  it("shows loading text while submitting", async () => {
    let resolveSignup: (value: { access_token: string; refresh_token: string; token_type: string }) => void;
    vi.mocked(signup).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignup = resolve;
        }),
    );
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText("사용자 이름"), "홍길동");
    await user.type(screen.getByLabelText("이메일 주소"), "hong@test.com");
    await user.type(screen.getByLabelText("비밀번호"), "password123");
    await user.click(screen.getByRole("button", { name: /회원가입/i }));

    expect(screen.getByText("가입 중...")).toBeInTheDocument();

    resolveSignup!({ access_token: "tok", refresh_token: "ref", token_type: "bearer" });
    await waitFor(() => {
      expect(screen.getByText(/회원가입/)).toBeInTheDocument();
    });
  });

  it("password input has minLength attribute", () => {
    renderWithProviders(<SignupPage />);
    const passwordInput = screen.getByLabelText("비밀번호");
    expect(passwordInput).toHaveAttribute("minLength", "8");
  });
});
