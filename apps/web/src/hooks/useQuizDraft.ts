import { useState, useCallback, useMemo } from "react";

const DRAFT_KEY_PREFIX = "quiznote_draft:";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface QuizDraft {
  answers: Record<string, string>;
  itemIds: string[];
  elapsedSec: number;
  savedAt: number;
  skippedIds?: string[];
}

interface UseQuizDraftReturn {
  saveDraft: (answers: Record<string, string>, elapsedSec: number, skippedIds?: Set<string>) => void;
  clearDraft: () => void;
}

export interface DraftSnapshot {
  answers: Record<string, string>;
  elapsedSec: number;
  skippedIds: Set<string>;
}

function getDraftKey(quizId: string): string {
  return `${DRAFT_KEY_PREFIX}${quizId}`;
}

function readDraft(quizId: string): QuizDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getDraftKey(quizId));
    if (!raw) return null;
    return JSON.parse(raw) as QuizDraft;
  } catch {
    return null;
  }
}

function isValidDraft(draft: QuizDraft, sortedIds: string[]): boolean {
  if (Date.now() - draft.savedAt > EXPIRY_MS) return false;
  if (draft.itemIds.length !== sortedIds.length) return false;
  return draft.itemIds.every((id, i) => id === sortedIds[i]);
}

/** Read and validate a draft snapshot for the given quiz. Pure function, no hooks. */
export function loadDraftSnapshot(
  quizId: string,
  itemIds: string[],
): DraftSnapshot | null {
  const sortedIds = itemIds.slice().sort();
  const draft = readDraft(quizId);
  if (!draft || !isValidDraft(draft, sortedIds)) {
    if (draft) localStorage.removeItem(getDraftKey(quizId));
    return null;
  }

  const idSet = new Set(sortedIds);
  const validAnswers: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft.answers)) {
    if (idSet.has(k)) validAnswers[k] = v;
  }

  if (Object.keys(validAnswers).length === 0) return null;

  const skippedIds = new Set(
    (draft.skippedIds ?? []).filter((id) => idSet.has(id)),
  );

  return { answers: validAnswers, elapsedSec: draft.elapsedSec, skippedIds };
}

/** Hook providing save/clear operations for quiz draft. */
export function useQuizDraft(
  quizId: string,
  itemIds: string[],
): UseQuizDraftReturn {
  const sortedIds = useMemo(() => itemIds.slice().sort(), [itemIds]);

  const saveDraft = useCallback(
    (answers: Record<string, string>, elapsedSec: number, skippedIds?: Set<string>) => {
      if (typeof window === "undefined") return;
      const draft: QuizDraft = {
        answers,
        itemIds: sortedIds,
        elapsedSec,
        savedAt: Date.now(),
        skippedIds: skippedIds ? [...skippedIds] : undefined,
      };
      try {
        localStorage.setItem(getDraftKey(quizId), JSON.stringify(draft));
      } catch {
        // localStorage full or unavailable
      }
    },
    [quizId, sortedIds],
  );

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(getDraftKey(quizId));
  }, [quizId]);

  return { saveDraft, clearDraft };
}

/** Hook to track whether the restored-draft banner should be shown. */
export function useDraftBanner(initiallyRestored: boolean) {
  const [dismissed, setDismissed] = useState(false);
  const wasRestored = initiallyRestored && !dismissed;
  const dismissRestored = useCallback(() => setDismissed(true), []);
  return { wasRestored, dismissRestored };
}
