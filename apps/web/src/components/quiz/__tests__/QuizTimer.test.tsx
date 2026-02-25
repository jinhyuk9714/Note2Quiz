import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizTimer } from "../QuizTimer";

describe("QuizTimer", () => {
  it("renders formatted time when enabled", () => {
    render(<QuizTimer elapsedSec={65} enabled onToggle={vi.fn()} />);
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("hides time display when disabled", () => {
    render(<QuizTimer elapsedSec={65} enabled={false} onToggle={vi.fn()} />);
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it("calls onToggle when button is clicked", async () => {
    const onToggle = vi.fn();
    render(<QuizTimer elapsedSec={0} enabled onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
