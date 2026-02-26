"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FileText, Folder as FolderIcon, Trash2, Zap, Calendar, Hash, Sparkles, ChevronRight } from "lucide-react";
import type { Document } from "@/types/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { deleteDocument } from "@/lib/api";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FolderMoveDropdown } from "./FolderMoveDropdown";

interface DocumentCardProps {
  document: Document;
  onSelect?: (id: string) => void;
}

export function DocumentCard({ document, onSelect }: DocumentCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteDocument(document.id),
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("문서가 삭제되었습니다");
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
    <div
      onClick={() => router.push(`/documents/${document.id}`)}
      className="group bento-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:border-indigo-400/50"
    >
      <div className="flex items-start gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-alt text-text-tertiary transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-200 dark:group-hover:shadow-none">
          <FileText className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-text-primary group-hover:text-indigo-600 transition-colors tracking-tight">
            {document.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-tertiary">
              <Hash className="h-3.5 w-3.5" />
              {document.char_count.toLocaleString()}자
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-tertiary">
              <Zap className="h-3.5 w-3.5" />
              {document.chunk_count}개 섹션
            </div>
            {document.quiz_count > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                <Sparkles className="h-3.5 w-3.5" />
                {document.quiz_count}개 퀴즈
              </div>
            )}
            {document.folder_name && (
              <div className="flex items-center gap-1.5 text-xs font-black text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-lg">
                <FolderIcon className="h-3.5 w-3.5" />
                {document.folder_name}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-tertiary">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(document.created_at)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-0 flex w-full sm:w-auto items-center gap-3">
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(document.id);
            }}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 dark:shadow-none"
          >
            퀴즈 생성
          </button>
        )}
        <FolderMoveDropdown documentId={document.id} currentFolderId={document.folder_id} />
        <button
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-text-tertiary transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
          title="삭제"
          aria-label="문서 삭제"
        >
          {mutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-alt text-text-tertiary group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
          <ChevronRight className="h-6 w-6" />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
        title="문서 삭제"
        description={`"${document.title}" 문서를 삭제하시겠습니까? 연결된 퀴즈도 함께 삭제됩니다.`}
        loading={mutation.isPending}
      />
    </div>
  );
}
