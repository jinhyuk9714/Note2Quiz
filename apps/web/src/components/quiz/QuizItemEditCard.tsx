"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Trash2,
  Save,
  X,
  Plus,
  Minus,
  ListOrdered,
  CheckSquare,
  PenTool,
  HelpCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { updateQuizItem, deleteQuizItem } from "@/lib/api";
import type { FlashcardItem, QuizItemUpdatePayload } from "@/types/api";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

const TYPE_CONFIG: Record<string, { label: string; icon: typeof ListOrdered; color: string; bg: string }> = {
  mcq: { label: "객관식", icon: ListOrdered, color: "text-blue-500", bg: "bg-blue-50" },
  true_false: { label: "O/X", icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-50" },
  fill_blank: { label: "빈칸 채우기", icon: PenTool, color: "text-purple-500", bg: "bg-purple-50" },
  short_answer: { label: "단답형", icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-50" },
};

interface QuizItemEditCardProps {
  item: FlashcardItem;
  index: number;
  quizId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  canDelete: boolean;
}

export function QuizItemEditCard({
  item,
  index,
  quizId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
  canDelete,
}: QuizItemEditCardProps) {
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Edit form state
  const [question, setQuestion] = useState(item.question);
  const [correctAnswer, setCorrectAnswer] = useState(item.correct_answer);
  const [explanation, setExplanation] = useState(item.explanation);
  const [options, setOptions] = useState<Record<string, string>>(item.options ?? {});
  const [conceptTags, setConceptTags] = useState(item.concept_tags.join(", "));
  const [difficulty, setDifficulty] = useState(item.difficulty);

  const updateMutation = useMutation({
    mutationFn: (data: QuizItemUpdatePayload) => updateQuizItem(quizId, item.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["quiz-study", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      toast.success("문항이 수정되었습니다");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuizItem(quizId, item.id),
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["quiz-study", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("문항이 삭제되었습니다");
      onDeleted();
    },
    onError: (err: Error) => {
      setConfirmDeleteOpen(false);
      toast.error(err.message);
    },
  });

  function resetForm() {
    setQuestion(item.question);
    setCorrectAnswer(item.correct_answer);
    setExplanation(item.explanation);
    setOptions(item.options ?? {});
    setConceptTags(item.concept_tags.join(", "));
    setDifficulty(item.difficulty);
  }

  function handleCancel() {
    resetForm();
    onCancelEdit();
  }

  function handleSave() {
    const tags = conceptTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data: QuizItemUpdatePayload = {
      question,
      correct_answer: correctAnswer,
      explanation,
      concept_tags: tags,
      difficulty,
    };

    if (item.quiz_type === "mcq") {
      data.options = options;
    }

    updateMutation.mutate(data);
  }

  function handleOptionChange(key: string, value: string) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddOption() {
    const existingKeys = Object.keys(options).sort();
    const lastKey = existingKeys[existingKeys.length - 1] ?? "@";
    const nextKey = String.fromCharCode(lastKey.charCodeAt(0) + 1);
    setOptions((prev) => ({ ...prev, [nextKey]: "" }));
  }

  function handleRemoveOption(key: string) {
    setOptions((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    if (correctAnswer === key) setCorrectAnswer("");
  }

  const typeConfig = TYPE_CONFIG[item.quiz_type];
  const TypeIcon = typeConfig?.icon ?? HelpCircle;

  // View mode
  if (!isEditing) {
    return (
      <div className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 transition-all hover:border-slate-300">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 text-xs font-black">
            {index}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold", typeConfig?.bg, typeConfig?.color)}>
                <TypeIcon className="h-3 w-3" />
                {typeConfig?.label}
              </span>
              {item.difficulty > 0 && (
                <span className="text-[10px] font-bold text-amber-500">
                  {"★".repeat(item.difficulty)}{"☆".repeat(Math.max(0, 5 - item.difficulty))}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 leading-relaxed">{item.question}</p>

            {item.options && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(item.options).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                  <span
                    key={k}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                      k === item.correct_answer
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-50 text-slate-600 ring-slate-200",
                    )}
                  >
                    <span className="font-bold">{k}.</span> {v}
                    {k === item.correct_answer && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  </span>
                ))}
              </div>
            )}

            {!item.options && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                정답: {item.correct_answer}
              </div>
            )}

            {item.explanation && (
              <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                <span className="leading-relaxed">{item.explanation}</span>
              </div>
            )}

            {item.concept_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.concept_tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onStartEdit}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600"
              title="편집"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {canDelete && (
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                title="삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmDeleteOpen}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setConfirmDeleteOpen(false)}
          title="문항 삭제"
          description="이 문항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          loading={deleteMutation.isPending}
        />
      </div>
    );
  }

  // Edit mode
  return (
    <div className="overflow-hidden rounded-[2rem] border-2 border-indigo-300 bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 text-xs font-black">
            {index}
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold", typeConfig?.bg, typeConfig?.color)}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig?.label}
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Question */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">문제</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        {/* MCQ Options */}
        {item.quiz_type === "mcq" && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">보기</label>
            <div className="space-y-2">
              {Object.entries(options).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(key)}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-all",
                      correctAnswer === key
                        ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                    )}
                    title={correctAnswer === key ? "정답" : "정답으로 선택"}
                  >
                    {key}
                  </button>
                  <input
                    value={value}
                    onChange={(e) => handleOptionChange(key, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder={`보기 ${key}`}
                  />
                  {Object.keys(options).length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(key)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {Object.keys(options).length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> 보기 추가
                </button>
              )}
            </div>
          </div>
        )}

        {/* Correct answer (non-MCQ) */}
        {item.quiz_type !== "mcq" && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">정답</label>
            {item.quiz_type === "true_false" ? (
              <div className="flex gap-2">
                {["O", "X"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCorrectAnswer(v)}
                    className={cn(
                      "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                      correctAnswer === v
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            )}
          </div>
        )}

        {/* Explanation */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">해설</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        {/* Concept tags + Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              개념 태그 <span className="font-medium normal-case">(쉼표 구분, 최대 5개)</span>
            </label>
            <input
              value={conceptTags}
              onChange={(e) => setConceptTags(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="수학, 미적분"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">난이도</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "flex-1 rounded-lg py-2.5 text-sm font-bold transition-all",
                    d <= difficulty
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                  )}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || !question.trim() || !correctAnswer.trim() || !explanation.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              저장 중...
            </span>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
