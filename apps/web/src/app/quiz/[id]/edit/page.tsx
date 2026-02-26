"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpenCheck,
  ChevronLeft,
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getQuizForStudy, updateQuiz } from "@/lib/api";
import type { FlashcardQuiz } from "@/types/api";
import { QuizItemEditCard } from "@/components/quiz/QuizItemEditCard";
import { QuizItemCreateForm } from "@/components/quiz/QuizItemCreateForm";

export default function QuizEditPage() {
  const { id } = useParams<{ id: string }>();

  const { data: quiz, isLoading, error } = useQuery({
    queryKey: ["quiz-study", id],
    queryFn: () => getQuizForStudy(id),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 animate-pulse">
          <BookOpenCheck className="h-8 w-8" />
        </div>
        <p className="text-sm font-bold text-text-tertiary">퀴즈를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">퀴즈를 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          {error instanceof Error ? error.message : "존재하지 않거나 삭제된 퀴즈입니다."}
        </p>
        <Link
          href="/quiz/history"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-surface-alt px-6 py-3 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt/80"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return <QuizEditView quiz={quiz} quizId={id} />;
}

function QuizEditView({ quiz, quizId }: { quiz: FlashcardQuiz; quizId: string }) {
  const queryClient = useQueryClient();

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(quiz.title);

  // Item editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Add new item
  const [showAddForm, setShowAddForm] = useState(false);

  const titleMutation = useMutation({
    mutationFn: (title: string) => updateQuiz(quizId, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["quiz-study", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("제목이 수정되었습니다");
      setEditingTitle(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleTitleSave() {
    if (!titleDraft.trim()) return;
    titleMutation.mutate(titleDraft.trim());
  }

  function handleTitleCancel() {
    setTitleDraft(quiz.title);
    setEditingTitle(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Breadcrumb */}
      <div className="flex flex-col gap-1">
        <Link
          href={`/quiz/${quizId}`}
          className="group mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-text-tertiary transition-colors hover:text-indigo-600"
        >
          <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
          퀴즈로 돌아가기
        </Link>

        {/* Title */}
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") handleTitleCancel();
              }}
              className="flex-1 rounded-xl border border-indigo-300 bg-surface-card px-4 py-2 text-2xl font-extrabold tracking-tight text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-200"
              autoFocus
            />
            <button
              onClick={handleTitleSave}
              disabled={titleMutation.isPending || !titleDraft.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleTitleCancel}
              disabled={titleMutation.isPending}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-text-secondary hover:bg-surface-alt/80 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
              {quiz.title}
            </h1>
            <button
              onClick={() => {
                setTitleDraft(quiz.title);
                setEditingTitle(true);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all"
              title="제목 편집"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <p className="text-sm font-medium text-text-secondary">
          {quiz.item_count}개 문항 편집 중
        </p>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {quiz.items.map((item, i) => (
          <QuizItemEditCard
            key={item.id}
            item={item}
            index={i + 1}
            quizId={quizId}
            isEditing={editingItemId === item.id}
            onStartEdit={() => setEditingItemId(item.id)}
            onCancelEdit={() => setEditingItemId(null)}
            onSaved={() => setEditingItemId(null)}
            onDeleted={() => setEditingItemId(null)}
            canDelete={quiz.items.length > 1}
          />
        ))}
      </div>

      {/* Add new item */}
      {showAddForm ? (
        <QuizItemCreateForm
          quizId={quizId}
          onCreated={() => setShowAddForm(false)}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[2rem] border-2 border-dashed border-border-default bg-surface-alt py-5 text-sm font-bold text-text-tertiary transition-all hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <Plus className="h-4 w-4" />
          문항 추가
        </button>
      )}

      {/* Bottom CTA */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={`/quiz/${quizId}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-indigo-600 py-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]"
        >
          퀴즈 풀기
        </Link>
        <Link
          href={`/quiz/${quizId}/flashcard`}
          className="flex-1 flex items-center justify-center gap-2 rounded-[1.5rem] bg-surface-card border border-border-default py-5 text-sm font-bold text-text-secondary shadow-sm transition-all hover:bg-surface-alt active:scale-[0.98]"
        >
          플래시카드로 보기
        </Link>
      </div>
    </div>
  );
}
