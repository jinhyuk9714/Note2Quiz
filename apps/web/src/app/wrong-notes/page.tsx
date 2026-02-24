"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWrongNotes } from "@/lib/api";
import { WrongNoteCard } from "@/components/wrong-notes/WrongNoteCard";
import { cn } from "@/lib/utils";

export default function WrongNotesPage() {
  const [dueOnly, setDueOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wrong-notes", dueOnly],
    queryFn: () => listWrongNotes(dueOnly),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">오답노트</h1>

        <div className="flex rounded-md border border-gray-200 text-sm">
          <button
            onClick={() => setDueOnly(false)}
            className={cn(
              "px-3 py-1.5 transition-colors",
              !dueOnly
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-500 hover:bg-gray-50",
            )}
          >
            전체
          </button>
          <button
            onClick={() => setDueOnly(true)}
            className={cn(
              "px-3 py-1.5 transition-colors",
              dueOnly
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-500 hover:bg-gray-50",
            )}
          >
            복습 예정
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">로딩 중...</p>}

      {error && (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "오류가 발생했습니다"}
        </p>
      )}

      {data && data.notes.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">
          {dueOnly
            ? "복습 예정인 오답노트가 없습니다"
            : "아직 오답노트가 없습니다. 퀴즈를 풀어보세요!"}
        </p>
      )}

      {data && data.notes.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{data.total}개</p>
          {data.notes.map((note) => (
            <WrongNoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
