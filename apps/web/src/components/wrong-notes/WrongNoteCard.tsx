"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Brain, Calendar, Info, Tag, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reviewWrongNote, deleteWrongNote } from "@/lib/api";
import type { WrongNote } from "@/types/api";
import { cn, formatDate, getRelativeTime } from "@/lib/utils";
import { MasteryProgress } from "./MasteryProgress";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface WrongNoteCardProps {
  note: WrongNote;
}

export function WrongNoteCard({ note }: WrongNoteCardProps) {
  const queryClient = useQueryClient();
  const isOverdue =
    note.next_review_at && new Date(note.next_review_at) <= new Date();

  const mutation = useMutation({
    mutationFn: (quality: 1 | 3 | 5) => reviewWrongNote(note.id, quality),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wrong-notes"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteWrongNote(note.id),
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["wrong-notes"] });
      toast.success("오답노트가 삭제되었습니다");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmOpen(true);
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-[2rem] border bg-surface-card p-6 shadow-sm transition-all hover:shadow-md",
      note.is_mastered
        ? "border-l-4 border-l-emerald-400 dark:border-l-emerald-500 border-border-default"
        : "border-border-default",
    )}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 ring-1 ring-inset ring-red-100 dark:ring-red-800">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {note.concept_tags.map((tag) => (
              <Link
                key={tag}
                href={`/wrong-notes?concept_tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-100 dark:ring-indigo-800 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.next_review_at && (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset",
                isOverdue
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 ring-amber-200/50 dark:ring-amber-700 shadow-sm shadow-amber-100 dark:shadow-none"
                  : "bg-surface-alt text-text-tertiary ring-border-default/50",
              )}
            >
              {isOverdue ? "Review Due" : getRelativeTime(note.next_review_at)}
            </span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-alt text-text-tertiary transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
            title="삭제"
          >
            {deleteMutation.isPending ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <p className="text-[15px] font-bold leading-relaxed text-text-primary">{note.question}</p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-red-50/50 dark:bg-red-900/10 p-3 ring-1 ring-inset ring-red-100/50 dark:ring-red-800/30">
          <p className="text-[10px] font-black uppercase tracking-wider text-red-400 dark:text-red-500 mb-1">Your Answer</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{note.user_answer || "(No Answer)"}</p>
        </div>
        <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 p-3 ring-1 ring-inset ring-emerald-100/50 dark:ring-emerald-800/30">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 dark:text-emerald-500 mb-1">Correct Answer</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{note.correct_answer}</p>
        </div>
      </div>

      {note.wrong_reason && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-surface-alt p-4 ring-1 ring-inset ring-border-default/30 text-text-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <p className="text-xs font-medium leading-relaxed">
            <span className="font-bold text-text-primary">분석: </span>
            {note.wrong_reason}
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border-default pt-5">
        <div className="flex items-center gap-4 text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
          <MasteryProgress consecutiveCorrect={note.consecutive_correct} isMastered={note.is_mastered} easeFactor={note.ease_factor} />
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(note.created_at)}
          </div>
        </div>
      </div>

      {/* Review buttons (hidden for mastered notes) */}
      {note.is_mastered ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          숙달 완료
        </div>
      ) : (
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => mutation.mutate(1)}
            disabled={mutation.isPending}
            className="group flex-1 flex flex-col items-center gap-1 rounded-xl bg-surface-card border border-border-default py-3 text-xs font-bold text-text-secondary transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 active:scale-95"
          >
            <XCircle className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
            모르겠어요
          </button>
          <button
            onClick={() => mutation.mutate(3)}
            disabled={mutation.isPending}
            className="group flex-1 flex flex-col items-center gap-1 rounded-xl bg-surface-card border border-border-default py-3 text-xs font-bold text-text-secondary transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-700 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-50 active:scale-95"
          >
            <AlertCircle className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
            어려웠어요
          </button>
          <button
            onClick={() => mutation.mutate(5)}
            disabled={mutation.isPending}
            className="group flex-1 flex flex-col items-center gap-1 rounded-xl bg-surface-card border border-border-default py-3 text-xs font-bold text-text-secondary transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            쉬웠어요
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
        title="오답노트 삭제"
        description="이 오답노트를 삭제하시겠습니까?"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
