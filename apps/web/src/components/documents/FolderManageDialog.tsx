"use client";

import { useEffect, useRef, useState } from "react";
import { Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  "#6366F1", // indigo
  "#3B82F6", // blue
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#8B5CF6", // violet
];

const EMOJI_PRESETS = ["📚", "📝", "🧪", "🔬", "📐", "💻", "🎨", "🌍", "🎵", "⚡"];

interface FolderManageDialogProps {
  open: boolean;
  onSave: (data: { name: string; color?: string; emoji?: string }) => void;
  onCancel: () => void;
  loading?: boolean;
  initial?: { name: string; color: string | null; emoji: string | null };
  title?: string;
}

export function FolderManageDialog(props: FolderManageDialogProps) {
  if (!props.open) return null;
  return <FolderManageDialogInner {...props} />;
}

function FolderManageDialogInner({
  onSave,
  onCancel,
  loading = false,
  initial,
  title = "새 폴더",
}: FolderManageDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLOR_PRESETS[0]);
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel]);

  function handleSubmit() {
    if (!name.trim() || loading) return;
    onSave({
      name: name.trim(),
      color: color || undefined,
      emoji: emoji || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !loading && onCancel()}
        aria-hidden
      />

      <div className="relative w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FolderIcon className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">
              폴더 이름
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="예: 미적분학, 운영체제"
              maxLength={200}
              className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">
              색상
            </label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all",
                    color === c
                      ? "ring-2 ring-offset-2 ring-text-tertiary scale-110"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">
              아이콘
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(emoji === e ? "" : e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-base transition-all",
                    emoji === e
                      ? "bg-indigo-100 ring-2 ring-indigo-300"
                      : "bg-surface-alt hover:bg-surface-alt/80",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-border-default bg-surface-card px-5 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                저장 중...
              </span>
            ) : (
              "저장"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
