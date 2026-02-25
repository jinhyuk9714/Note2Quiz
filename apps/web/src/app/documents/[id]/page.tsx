"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  Hash,
  Zap,
  Calendar,
  Sparkles,
  Trash2,
  History,
  Pencil,
} from "lucide-react";
import { getDocument, listQuizzes, deleteDocument, updateDocument } from "@/lib/api";
import { QuizHistoryCard } from "@/components/quiz/QuizHistoryCard";
import { ChunkViewer } from "@/components/documents/ChunkViewer";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data: doc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id),
  });

  const { data: quizData } = useQuery({
    queryKey: ["quizzes", { document_id: id }],
    queryFn: () => listQuizzes({ document_id: id }),
    enabled: !!doc,
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => updateDocument(id, { title }),
    onSuccess: () => {
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["document", id] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(id),
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push("/documents");
    },
  });

  function startEditing() {
    if (!doc) return;
    setEditTitle(doc.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleRenameSubmit() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === doc?.title) {
      setIsEditing(false);
      return;
    }
    renameMutation.mutate(trimmed);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <FileText className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-slate-400">
          문서를 불러오는 중...
        </p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          문서를 찾을 수 없습니다
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {error instanceof Error
            ? error.message
            : "존재하지 않거나 삭제된 문서입니다."}
        </p>
        <Link
          href="/documents"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const quizzes = quizData?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href="/documents"
            className="group mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-indigo-600"
          >
            <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Back to Documents
          </Link>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              onBlur={handleRenameSubmit}
              maxLength={500}
              disabled={renameMutation.isPending}
              className="w-full rounded-2xl border border-indigo-300 bg-white px-4 py-2 text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50"
            />
          ) : (
            <div className="group/title flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {doc.title}
              </h1>
              <button
                onClick={startEditing}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-500 group-hover/title:opacity-100"
                title="이름 변경"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
              {doc.source_type === "pdf" ? "PDF" : "텍스트"}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Hash className="h-3.5 w-3.5" />
              {doc.char_count.toLocaleString()}자
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Zap className="h-3.5 w-3.5" />
              {doc.chunk_count}개 섹션
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(doc.created_at)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/quiz/generate?document_id=${doc.id}`}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            퀴즈 생성
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleteMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="삭제"
          >
            {deleteMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {(deleteMutation.isError || renameMutation.isError) && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {deleteMutation.error?.message ?? renameMutation.error?.message}
        </div>
      )}

      {/* Chunk Viewer */}
      {doc.chunks.length > 0 && <ChunkViewer chunks={doc.chunks} />}

      {/* Related Quizzes */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 px-1 text-lg font-bold text-slate-800">
          <History className="h-5 w-5 text-indigo-600" />
          관련 퀴즈
          {quizzes.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
              {quizzes.length}개
            </span>
          )}
        </h3>

        {quizzes.length > 0 ? (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <QuizHistoryCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center backdrop-blur-sm">
            <h4 className="text-base font-bold text-slate-800">
              아직 생성된 퀴즈가 없습니다
            </h4>
            <p className="mt-2 text-sm font-medium text-slate-500">
              이 문서에서 퀴즈를 생성해보세요.
            </p>
            <Link
              href={`/quiz/generate?document_id=${doc.id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              퀴즈 생성하기
            </Link>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
        title="문서 삭제"
        description={`"${doc.title}" 문서를 삭제하시겠습니까? 연결된 퀴즈도 함께 삭제됩니다.`}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
