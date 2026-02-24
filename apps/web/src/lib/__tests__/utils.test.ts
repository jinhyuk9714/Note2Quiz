import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDate, getRelativeTime, cn } from "../utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("formats ISO date to ko-KR date", () => {
    const result = formatDate("2025-03-15T10:00:00Z");
    expect(result).toContain("2025");
    expect(result).toContain("15");
  });
});

describe("getRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "복습 기한 지남" for past dates', () => {
    expect(getRelativeTime("2025-06-09T00:00:00Z")).toBe("복습 기한 지남");
  });

  it('returns "오늘 복습!" for today', () => {
    // Math.ceil(diff/day): same timestamp => diff=0 => ceil(0)=0 => "오늘 복습!"
    expect(getRelativeTime("2025-06-10T12:00:00Z")).toBe("오늘 복습!");
  });

  it('returns "내일 복습" for tomorrow', () => {
    expect(getRelativeTime("2025-06-11T12:00:00Z")).toBe("내일 복습");
  });

  it('returns "N일 후 복습" for future dates', () => {
    expect(getRelativeTime("2025-06-15T12:00:00Z")).toBe("5일 후 복습");
  });
});
