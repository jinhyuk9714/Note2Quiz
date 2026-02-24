"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Zap, Calendar, Hash } from "lucide-react";
import type { Document } from "@/types/api";
import { formatDate } from "@/lib/utils";
import { deleteDocument } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  document: Document;
  onSelect?: (id: string) => void;
}

export function DocumentCard({ document, onSelect }: DocumentCardProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteDocument(document.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !window.confirm(
        `"${document.title}" 문서를 삭제하시겠습니까?\n연결된 퀴즈도 함께 삭제됩니다.`,
      )
    )
      return;
    mutation.mutate();
  }

  return (
    <div 
      onClick={() => onSelect?.(document.id)}
      className={cn(
        "group flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
        onSelect && "cursor-pointer hover:border-indigo-200"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-500">
          <FileText className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
            {document.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Hash className="h-3.5 w-3.5" />
              {document.char_count.toLocaleString()}자
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Zap className="h-3.5 w-3.5" />
              {document.chunk_count}개 섹션
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(document.created_at)}
            </div>
          </div>
          {mutation.isError && (
            <p className="mt-2 text-xs font-bold text-red-500">
              {mutation.error.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-0 flex w-full sm:w-auto items-center gap-2">
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(document.id);
            }}
            className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-600 hover:text-white"
          >
            퀴즈 생성
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="삭제"
        >
          {mutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
