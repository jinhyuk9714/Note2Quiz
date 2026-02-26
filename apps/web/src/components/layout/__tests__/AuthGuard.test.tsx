import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthGuard } from "../AuthGuard";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => <div data-testid="mobile-header">MobileHeader</div>,
}));

vi.mock("@/components/layout/MobileDrawer", () => ({
  MobileDrawer: () => <div data-testid="mobile-drawer">MobileDrawer</div>,
}));

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const baseMock = {
  setToken: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when isLoading is true", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseMock,
      user: null,
      isLoading: true,
    });
    vi.mocked(usePathname).mockReturnValue("/");

    render(<AuthGuard><p>Child</p></AuthGuard>);
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
    expect(screen.queryByText("Child")).not.toBeInTheDocument();
  });

  it("renders children directly on public path /login", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseMock,
      user: null,
      isLoading: false,
    });
    vi.mocked(usePathname).mockReturnValue("/login");

    render(<AuthGuard><p>Login Form</p></AuthGuard>);
    expect(screen.getByText("Login Form")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("renders children directly on public path /signup", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseMock,
      user: null,
      isLoading: false,
    });
    vi.mocked(usePathname).mockReturnValue("/signup");

    render(<AuthGuard><p>Signup Form</p></AuthGuard>);
    expect(screen.getByText("Signup Form")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated on protected route", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseMock,
      user: null,
      isLoading: false,
    });
    vi.mocked(usePathname).mockReturnValue("/documents");

    render(<AuthGuard><p>Protected</p></AuthGuard>);
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("renders authenticated layout with sidebar on protected route", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseMock,
      user: { id: "u1", email: "a@b.com", display_name: "User" },
      isLoading: false,
    });
    vi.mocked(usePathname).mockReturnValue("/");

    render(<AuthGuard><p>Dashboard</p></AuthGuard>);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-header")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
