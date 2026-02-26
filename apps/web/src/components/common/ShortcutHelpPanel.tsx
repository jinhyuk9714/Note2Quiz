"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutHelpPanelProps {
  shortcuts: Shortcut[];
}

export function ShortcutHelpPanel({ shortcuts }: ShortcutHelpPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        e.stopPropagation();
      }
    }
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [open]);

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
      {open && (
        <div className="absolute bottom-14 right-0 w-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
              키보드 단축키
            </h4>
            <button
              onClick={() => setOpen(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">
                  {s.description}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {s.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 ring-1 ring-inset ring-slate-200"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all hover:scale-110 active:scale-95",
          open
            ? "border-indigo-300 bg-indigo-600 text-white"
            : "border-slate-200 bg-white text-slate-400 hover:text-slate-600",
        )}
        title="키보드 단축키"
      >
        <Keyboard className="h-4 w-4" />
      </button>
    </div>
  );
}
