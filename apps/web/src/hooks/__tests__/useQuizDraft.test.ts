import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  loadDraftSnapshot,
  useQuizDraft,
  useDraftBanner,
} from "../useQuizDraft";

const QUIZ_ID = "quiz-1";
const ITEM_IDS = ["item-a", "item-b", "item-c"];
const DRAFT_KEY = `quiznote_draft:${QUIZ_ID}`;

function seedDraft(overrides: Record<string, unknown> = {}) {
  const draft = {
    answers: { "item-a": "A", "item-b": "O" },
    itemIds: [...ITEM_IDS].sort(),
    elapsedSec: 42,
    savedAt: Date.now(),
    ...overrides,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

describe("loadDraftSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no draft exists", () => {
    expect(loadDraftSnapshot(QUIZ_ID, ITEM_IDS)).toBeNull();
  });

  it("returns snapshot for a valid draft", () => {
    seedDraft();
    const snapshot = loadDraftSnapshot(QUIZ_ID, ITEM_IDS);
    expect(snapshot).toEqual({
      answers: { "item-a": "A", "item-b": "O" },
      elapsedSec: 42,
    });
  });

  it("rejects expired draft and removes from localStorage", () => {
    const expiredTime = Date.now() - 25 * 60 * 60 * 1000;
    seedDraft({ savedAt: expiredTime });
    expect(loadDraftSnapshot(QUIZ_ID, ITEM_IDS)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("rejects draft with mismatched itemIds", () => {
    seedDraft({ itemIds: ["item-x", "item-y"].sort() });
    expect(loadDraftSnapshot(QUIZ_ID, ITEM_IDS)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("filters out answers for unknown item IDs", () => {
    seedDraft({
      answers: { "item-a": "A", "item-b": "O", "item-unknown": "Z" },
    });
    const snapshot = loadDraftSnapshot(QUIZ_ID, ITEM_IDS);
    expect(snapshot?.answers).toEqual({ "item-a": "A", "item-b": "O" });
    expect(snapshot?.answers).not.toHaveProperty("item-unknown");
  });
});

describe("useQuizDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveDraft writes to localStorage", () => {
    const { result } = renderHook(() => useQuizDraft(QUIZ_ID, ITEM_IDS));
    act(() => {
      result.current.saveDraft({ "item-a": "B", "item-c": "X" }, 10);
    });
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY)!) as {
      answers: Record<string, string>;
      elapsedSec: number;
      itemIds: string[];
    };
    expect(stored.answers).toEqual({ "item-a": "B", "item-c": "X" });
    expect(stored.elapsedSec).toBe(10);
    expect(stored.itemIds).toEqual([...ITEM_IDS].sort());
  });

  it("clearDraft removes from localStorage", () => {
    seedDraft();
    const { result } = renderHook(() => useQuizDraft(QUIZ_ID, ITEM_IDS));
    act(() => {
      result.current.clearDraft();
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe("useDraftBanner", () => {
  it("returns wasRestored true when initially restored", () => {
    const { result } = renderHook(() => useDraftBanner(true));
    expect(result.current.wasRestored).toBe(true);
  });

  it("returns wasRestored false when not restored", () => {
    const { result } = renderHook(() => useDraftBanner(false));
    expect(result.current.wasRestored).toBe(false);
  });

  it("dismissRestored sets wasRestored to false", () => {
    const { result } = renderHook(() => useDraftBanner(true));
    expect(result.current.wasRestored).toBe(true);
    act(() => {
      result.current.dismissRestored();
    });
    expect(result.current.wasRestored).toBe(false);
  });
});
