"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, X, Save } from "lucide-react";
import { toast } from "sonner";
import { createQuizItem } from "@/lib/api";
import type { QuizItemCreatePayload } from "@/types/api";
import { cn } from "@/lib/utils";

const QUIZ_TYPE_OPTIONS: { value: QuizItemCreatePayload["quiz_type"]; label: string }[] = [
  { value: "mcq", label: "객관식" },
  { value: "short_answer", label: "단답형" },
  { value: "true_false", label: "O/X" },
  { value: "fill_blank", label: "빈칸 채우기" },
];

interface QuizItemCreateFormProps {
  quizId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function QuizItemCreateForm({ quizId, onCreated, onCancel }: QuizItemCreateFormProps) {
  const queryClient = useQueryClient();

  const [quizType, setQuizType] = useState<QuizItemCreatePayload["quiz_type"]>("short_answer");
  const [question, setQuestion] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({ A: "", B: "" });
  const [conceptTags, setConceptTags] = useState("");
  const [difficulty, setDifficulty] = useState(3);

  const mutation = useMutation({
    mutationFn: (data: QuizItemCreatePayload) => createQuizItem(quizId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["quiz-study", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success("문항이 추가되었습니다");
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSave() {
    const tags = conceptTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data: QuizItemCreatePayload = {
      quiz_type: quizType,
      question,
      correct_answer: correctAnswer,
      explanation,
      concept_tags: tags,
      difficulty,
    };

    if (quizType === "mcq") {
      data.options = options;
    }

    mutation.mutate(data);
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

  const isValid = question.trim() && correctAnswer.trim() && explanation.trim();

  return (
    <div className="overflow-hidden rounded-[2rem] border-2 border-dashed border-indigo-300 bg-indigo-50/30 p-6">
      <h4 className="mb-5 text-sm font-black uppercase tracking-wider text-indigo-600">새 문항 추가</h4>

      <div className="space-y-5">
        {/* Quiz type */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">문제 유형</label>
          <div className="flex flex-wrap gap-2">
            {QUIZ_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setQuizType(opt.value);
                  setCorrectAnswer("");
                  if (opt.value === "mcq") setOptions({ A: "", B: "" });
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-bold transition-all",
                  quizType === opt.value
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-surface-card text-text-secondary ring-1 ring-inset ring-border-default hover:bg-surface-alt",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">문제</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="문제를 입력하세요"
          />
        </div>

        {/* MCQ Options */}
        {quizType === "mcq" && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">보기</label>
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
                        : "bg-surface-card text-text-tertiary ring-1 ring-border-default hover:bg-surface-alt",
                    )}
                    title={correctAnswer === key ? "정답" : "정답으로 선택"}
                  >
                    {key}
                  </button>
                  <input
                    value={value}
                    onChange={(e) => handleOptionChange(key, e.target.value)}
                    className="flex-1 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    placeholder={`보기 ${key}`}
                  />
                  {Object.keys(options).length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(key)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-red-50 hover:text-red-600 transition-all"
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
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-text-tertiary hover:bg-surface-card transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> 보기 추가
                </button>
              )}
            </div>
          </div>
        )}

        {/* Correct answer (non-MCQ) */}
        {quizType !== "mcq" && (
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">정답</label>
            {quizType === "true_false" ? (
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
                        : "bg-surface-card text-text-secondary ring-1 ring-inset ring-border-default hover:bg-surface-alt",
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
                className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="정답을 입력하세요"
              />
            )}
          </div>
        )}

        {/* Explanation */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">해설</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="해설을 입력하세요"
          />
        </div>

        {/* Concept tags + Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">
              개념 태그 <span className="font-medium normal-case">(쉼표 구분, 최대 5개)</span>
            </label>
            <input
              value={conceptTags}
              onChange={(e) => setConceptTags(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-card px-4 py-3 text-sm font-medium text-text-primary focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="수학, 미적분"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-text-tertiary mb-1.5">난이도</label>
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
                      : "bg-surface-card text-text-tertiary ring-1 ring-inset ring-border-default hover:bg-surface-alt",
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
          onClick={onCancel}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-bold text-text-secondary transition-all hover:bg-surface-alt disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={mutation.isPending || !isValid}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              추가 중...
            </span>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              추가
            </>
          )}
        </button>
      </div>
    </div>
  );
}
