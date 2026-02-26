"use client";

import { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    },
    [onCancel, loading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    cancelRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const isDanger = variant === "danger";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && onCancel()}
            aria-hidden
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="relative w-full max-w-sm rounded-[2rem] bg-surface-card border border-border-default p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={`mb-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
                  isDanger
                    ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                }`}
              >
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h2
                id="confirm-title"
                className="text-xl font-black text-text-primary tracking-tight"
              >
                {title}
              </h2>
              <p
                id="confirm-desc"
                className="mt-2 text-sm font-medium leading-relaxed text-text-secondary"
              >
                {description}
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={loading}
                className="flex-1 rounded-2xl border border-border-default bg-surface-alt px-5 py-3.5 text-sm font-bold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:opacity-50 active:scale-95"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 active:scale-95 shadow-lg ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span className="sr-only">처리 중</span>
                  </span>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
