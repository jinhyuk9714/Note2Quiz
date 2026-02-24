"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, FileText, ListOrdered, CheckSquare, HelpCircle, PenTool, AlertCircle, ArrowRight } from "lucide-react";
import { listDocuments } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUIZ_TYPE_OPTIONS = [
  { value: "mcq", label: "객관식", icon: ListOrdered },
  { value: "short_answer", label: "단답형", icon: HelpCircle },
  { value: "true_false", label: "O/X", icon: CheckSquare },
  { value: "fill_blank", label: "빈칸 채우기", icon: PenTool },
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

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

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
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">퀴즈 구성하기</h2>
      </div>

      <div className="space-y-8">
        {/* Document Selection */}
        <div className="space-y-3">
          <label htmlFor="doc-select" className="ml-1 flex items-center gap-2 text-sm font-bold text-slate-700">
            <FileText className="h-4 w-4 text-slate-400" />
            학습 문서 선택
          </label>
          {docsLoading ? (
            <div className="h-12 animate-pulse rounded-2xl bg-slate-50" />
          ) : documents && documents.length > 0 ? (
            <div className="relative">
              <select
                id="doc-select"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="">문서를 선택하세요</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.char_count.toLocaleString()}자)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                <ArrowRight className="h-4 w-4 rotate-90" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 ring-1 ring-inset ring-amber-200/50">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-xs font-bold text-amber-700">
                업로드된 문서가 없습니다.{" "}
                <a href="/documents" className="underline decoration-2 underline-offset-2">
                  먼저 문서를 업로드하세요.
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Number of Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label htmlFor="n-questions" className="text-sm font-bold text-slate-700">
              문제 수
            </label>
            <span className="rounded-lg bg-indigo-50 px-3 py-1 text-sm font-black text-indigo-700 ring-1 ring-inset ring-indigo-200">
              {nQuestions}개
            </span>
          </div>
          <div className="px-1">
            <input
              id="n-questions"
              type="range"
              min={1}
              max={20}
              value={nQuestions}
              onChange={(e) => setNQuestions(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-100 accent-indigo-600 focus:outline-none"
            />
            <div className="mt-2 flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-0.5">
              <span>1 Question</span>
              <span>20 Questions</span>
            </div>
          </div>
        </div>

        {/* Quiz Types */}
        <div className="space-y-3">
          <p className="ml-1 text-sm font-bold text-slate-700">문제 유형 (중복 선택 가능)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUIZ_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleType(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-200 active:scale-95",
                  quizTypes.includes(value)
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <Icon className={cn("h-5 w-5", quizTypes.includes(value) ? "text-indigo-600" : "text-slate-400")} />
                <span className="text-xs font-bold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || isPending}
          className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              퀴즈 생성하기
              <Sparkles className="h-4 w-4 transition-transform group-hover:scale-125 group-hover:rotate-12" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
