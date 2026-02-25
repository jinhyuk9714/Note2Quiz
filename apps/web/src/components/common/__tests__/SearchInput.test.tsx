import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "../SearchInput";

describe("SearchInput", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with placeholder", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="검색..." />);
    expect(screen.getByPlaceholderText("검색...")).toBeInTheDocument();
  });

  it("calls onChange after debounce", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} debounceMs={300} />);

    const input = screen.getByPlaceholderText("검색...");
    // Use fireEvent instead of userEvent with fake timers
    await act(() => {
      (input as HTMLInputElement).focus();
      // Simulate typing by dispatching input events
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "hello");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Not called yet (debounce)
    expect(onChange).not.toHaveBeenCalled();

    // Advance timer past debounce
    await act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith("hello");
    vi.useRealTimers();
  });

  it("shows clear button when value is present", () => {
    render(<SearchInput value="test" onChange={vi.fn()} />);
    expect(screen.getByTitle("지우기")).toBeInTheDocument();
  });

  it("does not show clear button when empty", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByTitle("지우기")).not.toBeInTheDocument();
  });

  it("calls onChange with empty string on clear", async () => {
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    await userEvent.click(screen.getByTitle("지우기"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
