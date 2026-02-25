import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasteryProgress } from "../MasteryProgress";

describe("MasteryProgress", () => {
  it("renders 5 dots", () => {
    const { container } = render(
      <MasteryProgress consecutiveCorrect={0} isMastered={false} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots).toHaveLength(5);
  });

  it("fills correct number of dots", () => {
    const { container } = render(
      <MasteryProgress consecutiveCorrect={3} isMastered={false} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    const filled = Array.from(dots).filter((d) =>
      d.classList.contains("bg-indigo-500"),
    );
    const empty = Array.from(dots).filter((d) =>
      d.classList.contains("bg-slate-200"),
    );
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(2);
  });

  it("shows 0 filled when consecutiveCorrect is 0", () => {
    const { container } = render(
      <MasteryProgress consecutiveCorrect={0} isMastered={false} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    const filled = Array.from(dots).filter(
      (d) =>
        d.classList.contains("bg-indigo-500") ||
        d.classList.contains("bg-emerald-500"),
    );
    expect(filled).toHaveLength(0);
  });

  it("shows Mastered badge when isMastered is true", () => {
    render(<MasteryProgress consecutiveCorrect={5} isMastered={true} />);
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("uses emerald color for all dots when mastered", () => {
    const { container } = render(
      <MasteryProgress consecutiveCorrect={5} isMastered={true} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    const emerald = Array.from(dots).filter((d) =>
      d.classList.contains("bg-emerald-500"),
    );
    expect(emerald).toHaveLength(5);
  });

  it("does not show Mastered badge when not mastered", () => {
    render(<MasteryProgress consecutiveCorrect={3} isMastered={false} />);
    expect(screen.queryByText("Mastered")).not.toBeInTheDocument();
  });

  it("shows EF label when easeFactor is provided and not mastered", () => {
    render(
      <MasteryProgress consecutiveCorrect={2} isMastered={false} easeFactor={2.3} />,
    );
    expect(screen.getByText("EF 2.3")).toBeInTheDocument();
  });

  it("does not show EF label when mastered", () => {
    render(
      <MasteryProgress consecutiveCorrect={5} isMastered={true} easeFactor={2.5} />,
    );
    expect(screen.queryByText(/EF/)).not.toBeInTheDocument();
  });

  it("does not show EF label when easeFactor is not provided", () => {
    render(
      <MasteryProgress consecutiveCorrect={2} isMastered={false} />,
    );
    expect(screen.queryByText(/EF/)).not.toBeInTheDocument();
  });
});
