import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReviewShortcuts } from "../useReviewShortcuts";

function fireKey(key: string) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("useReviewShortcuts", () => {
  const onFlip = vi.fn();
  const onRate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not register listener when disabled", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: false,
        onFlip,
        onRate,
        enabled: false,
        isPending: false,
      }),
    );

    fireKey(" ");
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("calls onFlip when Space pressed and not flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: false,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey(" ");
    expect(onFlip).toHaveBeenCalledOnce();
  });

  it("does not call onFlip when Space pressed and already flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey(" ");
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("calls onRate(1) when key 1 pressed while flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey("1");
    expect(onRate).toHaveBeenCalledWith(1);
  });

  it("calls onRate(3) when key 3 pressed while flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey("3");
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it("calls onRate(5) when key 5 pressed while flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey("5");
    expect(onRate).toHaveBeenCalledWith(5);
  });

  it("does not call onRate when not flipped", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: false,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey("1");
    fireKey("3");
    fireKey("5");
    expect(onRate).not.toHaveBeenCalled();
  });

  it("does not call onRate when isPending is true", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: true,
      }),
    );

    fireKey("1");
    fireKey("3");
    fireKey("5");
    expect(onRate).not.toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const { unmount } = renderHook(() =>
      useReviewShortcuts({
        isFlipped: false,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    unmount();
    fireKey(" ");
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", () => {
    renderHook(() =>
      useReviewShortcuts({
        isFlipped: true,
        onFlip,
        onRate,
        enabled: true,
        isPending: false,
      }),
    );

    fireKey("2");
    fireKey("4");
    fireKey("a");
    fireKey("Enter");
    expect(onFlip).not.toHaveBeenCalled();
    expect(onRate).not.toHaveBeenCalled();
  });
});
