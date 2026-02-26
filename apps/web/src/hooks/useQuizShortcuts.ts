import { useEffect, useRef } from "react";
import type { QuizItem } from "@/types/api";

interface UseQuizShortcutsOptions {
  items: QuizItem[];
  currentIndex: number;
  setCurrentIndex: (idx: number | ((prev: number) => number)) => void;
  onAnswer: (itemId: string, value: string) => void;
  onSkip: (itemId: string) => void;
  onSubmit: () => void;
  enabled: boolean;
}

function scrollToItem(itemId: string) {
  document
    .getElementById(`quiz-item-${itemId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "text")
    return true;
  return false;
}

export function useQuizShortcuts(options: UseQuizShortcutsOptions): void {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled) return;

    function handler(e: KeyboardEvent) {
      const opts = optionsRef.current;
      if (!opts.enabled) return;

      const { items, currentIndex, setCurrentIndex, onAnswer, onSkip, onSubmit } = opts;
      if (items.length === 0) return;

      const textFocused = isTextInputFocused();

      // Cmd/Ctrl+Enter — submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit();
        return;
      }

      // Escape — blur text input
      if (e.key === "Escape") {
        if (textFocused) {
          (document.activeElement as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      // Number keys 1-9 — jump to question (works even in textarea)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        const targetIndex = parseInt(e.key) - 1;
        if (targetIndex < items.length) {
          if (textFocused) {
            (document.activeElement as HTMLElement).blur();
          }
          setCurrentIndex(targetIndex);
          scrollToItem(items[targetIndex].id);
          e.preventDefault();
        }
        return;
      }

      // Below this point: suppress when text input is focused
      if (textFocused) return;

      // Arrow keys — prev/next question
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const newIdx = Math.max(0, currentIndex - 1);
        setCurrentIndex(newIdx);
        scrollToItem(items[newIdx].id);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const newIdx = Math.min(items.length - 1, currentIndex + 1);
        setCurrentIndex(newIdx);
        scrollToItem(items[newIdx].id);
        return;
      }

      const currentItem = items[currentIndex];
      if (!currentItem) return;

      // A/B/C/D — MCQ answer
      const upperKey = e.key.toUpperCase();
      if (
        currentItem.quiz_type === "mcq" &&
        currentItem.options &&
        ["A", "B", "C", "D"].includes(upperKey) &&
        upperKey in currentItem.options
      ) {
        e.preventDefault();
        onAnswer(currentItem.id, upperKey);
        return;
      }

      // O/X — true_false answer
      if (
        currentItem.quiz_type === "true_false" &&
        (upperKey === "O" || upperKey === "X")
      ) {
        e.preventDefault();
        onAnswer(currentItem.id, upperKey);
        return;
      }

      // S — skip
      if (upperKey === "S") {
        e.preventDefault();
        onSkip(currentItem.id);
        return;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [options.enabled]);
}
