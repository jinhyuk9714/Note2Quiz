"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewWrongNote } from "@/lib/api";
import type { WrongNote } from "@/types/api";
import { cn, formatDate, getRelativeTime } from "@/lib/utils";

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
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <p className="text-sm font-medium leading-relaxed">{note.question}</p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">내 답: </span>
          <span className="font-medium text-red-600">{note.user_answer}</span>
        </div>
        <div>
          <span className="text-gray-500">정답: </span>
          <span className="font-medium text-green-600">
            {note.correct_answer}
          </span>
        </div>
      </div>

      {note.wrong_reason && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
          {note.wrong_reason}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {note.concept_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>연속 정답: {note.consecutive_correct}회</span>
        {note.next_review_at && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              isOverdue
                ? "bg-amber-50 text-amber-600"
                : "bg-gray-100 text-gray-500",
            )}
          >
            {getRelativeTime(note.next_review_at)}
          </span>
        )}
        <span>{formatDate(note.created_at)}</span>
      </div>

      {/* Review buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => mutation.mutate(true)}
          disabled={mutation.isPending}
          className="flex-1 rounded-md border border-green-300 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          {mutation.isPending ? "..." : "정답"}
        </button>
        <button
          onClick={() => mutation.mutate(false)}
          disabled={mutation.isPending}
          className="flex-1 rounded-md border border-red-300 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {mutation.isPending ? "..." : "오답"}
        </button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-500">{mutation.error.message}</p>
      )}
    </div>
  );
}
