import { useEffect, useRef } from "react";

interface UseReviewShortcutsOptions {
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (quality: 1 | 3 | 5) => void;
  enabled: boolean;
  isPending: boolean;
}

export function useReviewShortcuts(options: UseReviewShortcutsOptions): void {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled) return;

    function handler(e: KeyboardEvent) {
      const opts = optionsRef.current;
      if (!opts.enabled) return;

      // Space — flip card
      if (e.key === " ") {
        e.preventDefault();
        if (!opts.isFlipped) {
          opts.onFlip();
        }
        return;
      }

      // 1/3/5 — rate (only when flipped and not pending)
      if (opts.isFlipped && !opts.isPending) {
        if (e.key === "1") {
          e.preventDefault();
          opts.onRate(1);
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          opts.onRate(3);
          return;
        }
        if (e.key === "5") {
          e.preventDefault();
          opts.onRate(5);
          return;
        }
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [options.enabled]);
}
