import { useEffect, useRef } from "react";

interface UseFlashcardShortcutsOptions {
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrev: () => void;
  enabled: boolean;
}

export function useFlashcardShortcuts(
  options: UseFlashcardShortcutsOptions,
): void {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled) return;

    function handler(e: KeyboardEvent) {
      const opts = optionsRef.current;
      if (!opts.enabled) return;

      // Space — flip / unflip card
      if (e.key === " ") {
        e.preventDefault();
        opts.onFlip();
        return;
      }

      // ArrowRight / ArrowDown — next card
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        opts.onNext();
        return;
      }

      // ArrowLeft / ArrowUp — previous card
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        opts.onPrev();
        return;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [options.enabled]);
}
