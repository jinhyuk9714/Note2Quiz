import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../Pagination";

describe("Pagination", () => {
  it("does not render when total <= limit", () => {
    const { container } = render(
      <Pagination total={10} limit={20} offset={0} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows range text", () => {
    render(<Pagination total={50} limit={20} offset={0} onChange={vi.fn()} />);
    expect(screen.getByText(/50건 중 1-20/)).toBeInTheDocument();
  });

  it("shows correct range for second page", () => {
    render(<Pagination total={50} limit={20} offset={20} onChange={vi.fn()} />);
    expect(screen.getByText(/50건 중 21-40/)).toBeInTheDocument();
  });

  it("calls onChange with correct offset on next page", async () => {
    const onChange = vi.fn();
    render(<Pagination total={50} limit={20} offset={0} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("다음 페이지"));
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("disables prev button on first page", () => {
    render(<Pagination total={50} limit={20} offset={0} onChange={vi.fn()} />);
    expect(screen.getByLabelText("이전 페이지")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination total={50} limit={20} offset={40} onChange={vi.fn()} />);
    expect(screen.getByLabelText("다음 페이지")).toBeDisabled();
  });

  it("calls onChange when clicking page number", async () => {
    const onChange = vi.fn();
    // 3 pages total — all page numbers visible (1, 2, 3)
    render(<Pagination total={60} limit={20} offset={0} onChange={onChange} />);
    await userEvent.click(screen.getByText("3"));
    expect(onChange).toHaveBeenCalledWith(40);
  });
});
