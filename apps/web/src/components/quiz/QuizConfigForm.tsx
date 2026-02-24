"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const QUIZ_TYPE_OPTIONS = [
  { value: "mcq", label: "객관식" },
  { value: "short_answer", label: "단답형" },
  { value: "true_false", label: "O/X" },
  { value: "fill_blank", label: "빈칸 채우기" },
] as const;

interface QuizConfigFormProps {
  defaultDocumentId?: string;
  onSubmit: (config: {
    documentId: string;
    nQuestions: number;
    quizTypes: string[];
  }) => void;
  isPending: boolean;
}

export function QuizConfigForm({
  defaultDocumentId,
  onSubmit,
  isPending,
}: QuizConfigFormProps) {
  const [documentId, setDocumentId] = useState(defaultDocumentId ?? "");
  const [nQuestions, setNQuestions] = useState(5);
  const [quizTypes, setQuizTypes] = useState<string[]>([
    "mcq",
    "short_answer",
  ]);

  const toggleType = (type: string) => {
    setQuizTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const canSubmit = documentId.trim().length > 0 && quizTypes.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit({ documentId, nQuestions, quizTypes });
      }}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div>
        <label htmlFor="doc-id" className="mb-1 block text-sm font-medium">
          문서 ID
        </label>
        <input
          id="doc-id"
          type="text"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="업로드한 문서의 UUID"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="n-questions" className="mb-1 block text-sm font-medium">
          문제 수: {nQuestions}문제
        </label>
        <input
          id="n-questions"
          type="range"
          min={1}
          max={20}
          value={nQuestions}
          onChange={(e) => setNQuestions(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">문제 유형</p>
        <div className="flex flex-wrap gap-2">
          {QUIZ_TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleType(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                quizTypes.includes(value)
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 text-gray-500 hover:border-gray-400",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "생성 중..." : "퀴즈 생성"}
      </button>
    </form>
  );
}
