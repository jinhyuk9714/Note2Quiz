"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Brain, Calendar, Info, Tag, AlertCircle } from "lucide-react";
import { reviewWrongNote } from "@/lib/api";
import type { WrongNote } from "@/types/api";
import { cn, formatDate, getRelativeTime } from "@/lib/utils";
import { MasteryProgress } from "./MasteryProgress";

interface WrongNoteCardProps {
  note: WrongNote;
}

export function WrongNoteCard({ note }: WrongNoteCardProps) {
  const queryClient = useQueryClient();
  const isOverdue =
    note.next_review_at && new Date(note.next_review_at) <= new Date();

  const mutation = useMutation({
    mutationFn: (isCorrect: boolean) => reviewWrongNote(note.id, isCorrect),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wrong-notes"] });
    },
  });

  return (
    <div className={cn(
      "overflow-hidden rounded-[2rem] border bg-white p-6 shadow-sm transition-all hover:shadow-md",
      note.is_mastered
        ? "border-l-4 border-l-emerald-400 border-slate-200"
        : "border-slate-200",
    )}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 ring-1 ring-inset ring-red-100">
            <Brain className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {note.concept_tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-100"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>
        {note.next_review_at && (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset",
              isOverdue
                ? "bg-amber-50 text-amber-600 ring-amber-200/50 shadow-sm shadow-amber-100"
                : "bg-slate-50 text-slate-400 ring-slate-200/50",
            )}
          >
            {isOverdue ? "Review Due" : getRelativeTime(note.next_review_at)}
          </span>
        )}
      </div>

      <p className="text-[15px] font-bold leading-relaxed text-slate-800">{note.question}</p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-red-50/50 p-3 ring-1 ring-inset ring-red-100/50">
          <p className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-1">Your Answer</p>
          <p className="text-sm font-bold text-red-600">{note.user_answer || "(No Answer)"}</p>
        </div>
        <div className="rounded-xl bg-emerald-50/50 p-3 ring-1 ring-inset ring-emerald-100/50">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1">Correct Answer</p>
          <p className="text-sm font-bold text-emerald-600">{note.correct_answer}</p>
        </div>
      </div>

      {note.wrong_reason && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/30 text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs font-medium leading-relaxed">
            <span className="font-bold text-slate-700">분석: </span>
            {note.wrong_reason}
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
        <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          <MasteryProgress consecutiveCorrect={note.consecutive_correct} isMastered={note.is_mastered} />
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(note.created_at)}
          </div>
        </div>
      </div>

      {/* Review buttons (hidden for mastered notes) */}
      {note.is_mastered ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 py-3 text-sm font-bold text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          숙달 완료
        </div>
      ) : (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending}
            className="group flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-50 active:scale-95"
          >
            {mutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                알고 있어요
              </>
            )}
          </button>
          <button
            onClick={() => mutation.mutate(false)}
            disabled={mutation.isPending}
            className="group flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 active:scale-95"
          >
            {mutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-red-600" />
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
                아직 헷갈려요
              </>
            )}
          </button>
        </div>
      )}

      {mutation.isError && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-red-500 animate-in shake duration-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {mutation.error.message}
        </div>
      )}
    </div>
  );
}
