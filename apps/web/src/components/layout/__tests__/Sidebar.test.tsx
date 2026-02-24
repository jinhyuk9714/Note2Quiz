import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { usePathname } from "next/navigation";

describe("Sidebar", () => {
  it("renders all nav items", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Sidebar />);
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("문서 관리")).toBeInTheDocument();
    expect(screen.getByText("퀴즈 생성")).toBeInTheDocument();
    expect(screen.getByText("오답노트")).toBeInTheDocument();
  });

  it("highlights active route", () => {
    vi.mocked(usePathname).mockReturnValue("/documents");
    render(<Sidebar />);
    const docsLink = screen.getByText("문서 관리").closest("a");
    expect(docsLink?.className).toContain("indigo");
  });

  it("renders QuizNote brand link", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Sidebar />);
    expect(screen.getByText("QuizNote")).toBeInTheDocument();
  });
});
