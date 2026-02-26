"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, FileText, ListOrdered, CheckSquare, HelpCircle, PenTool, AlertCircle, ArrowRight, Type, Layers, Zap, ChevronDown, Target, X } from "lucide-react";
import { listDocuments, getDocument } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

const QUIZ_TYPE_OPTIONS = [
  { value: "mcq", label: "객관식", icon: ListOrdered },
  { value: "short_answer", label: "단답형", icon: HelpCircle },
  { value: "true_false", label: "O/X", icon: CheckSquare },
  { value: "fill_blank", label: "빈칸 채우기", icon: PenTool },
] as const;

interface QuizConfigFormProps {
  defaultDocumentId?: string;
  defaultFocusConcept?: string;
  onSubmit: (config: {
    documentId: string;
    nQuestions: number;
    quizTypes: string[];
    title: string;
    chunkIds?: string[];
    focusConcepts?: string[];
  }) => void;
  isPending: boolean;
  onCancel?: () => void;
}

export function QuizConfigForm({
  defaultDocumentId,
  defaultFocusConcept,
  onSubmit,
  isPending,
  onCancel,
}: QuizConfigFormProps) {
  const [documentId, setDocumentId] = useState(defaultDocumentId ?? "");
  const [title, setTitle] = useState("");
  const [nQuestions, setNQuestions] = useState(5);
  const [quizTypes, setQuizTypes] = useState<string[]>([
    "mcq",
    "short_answer",
  ]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());
  const [chunkSectionOpen, setChunkSectionOpen] = useState(false);
  const [focusConcept, setFocusConcept] = useState<string | null>(defaultFocusConcept ?? null);

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => listDocuments({ limit: 100 }),
  });
  const documents = docsData?.items;

  const { data: docDetail, isLoading: chunksLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: documentId.length > 0,
  });
  const chunks = docDetail?.chunks ?? [];

  const handleDocumentChange = (newDocId: string) => {
    setDocumentId(newDocId);
    setSelectedChunkIds(new Set());
    setChunkSectionOpen(false);
  };

  const toggleChunk = (chunkId: string) => {
    setSelectedChunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  };

  const selectAllChunks = () => {
    setSelectedChunkIds(new Set(chunks.map((c) => c.id)));
  };

  const deselectAllChunks = () => {
    setSelectedChunkIds(new Set());
  };

  const toggleType = (type: string) => {
    setQuizTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const canSubmit = documentId.trim().length > 0 && quizTypes.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const chunkIds = selectedChunkIds.size > 0 ? [...selectedChunkIds] : undefined;
    const focusConcepts = focusConcept ? [focusConcept] : undefined;
    onSubmit({ documentId, nQuestions, quizTypes, title, chunkIds, focusConcepts });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
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
        {/* Focus Concept Badge */}
        {focusConcept && (
          <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <Target className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-700">
              집중 개념:
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              {focusConcept}
              <button
                type="button"
                onClick={() => setFocusConcept(null)}
                className="rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
                aria-label="집중 개념 해제"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

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
                onChange={(e) => handleDocumentChange(e.target.value)}
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
                <Link href="/documents" className="underline decoration-2 underline-offset-2">
                  먼저 문서를 업로드하세요.
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Chunk Selection */}
        {documentId && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setChunkSectionOpen((prev) => !prev)}
              className="ml-1 flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Layers className="h-4 w-4 text-slate-400" />
              범위 선택
              {selectedChunkIds.size > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-600 ring-1 ring-inset ring-indigo-200">
                  {selectedChunkIds.size}/{chunks.length}
                </span>
              )}
              <span className="text-[11px] font-medium text-slate-400">(선택사항)</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", chunkSectionOpen && "rotate-180")} />
            </button>

            {chunkSectionOpen && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                {chunksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : chunks.length > 0 ? (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">
                        {selectedChunkIds.size > 0
                          ? `${selectedChunkIds.size}/${chunks.length}개 섹션 선택됨`
                          : "선택하지 않으면 전체 문서에서 출제됩니다"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllChunks}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          전체 선택
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={deselectAllChunks}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          전체 해제
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto">
                      {chunks.map((chunk) => {
                        const isSelected = selectedChunkIds.has(chunk.id);
                        return (
                          <label
                            key={chunk.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                              isSelected
                                ? "border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-300"
                                : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChunk(chunk.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                            />
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-black text-slate-500">
                              {chunk.index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                              {chunk.content.slice(0, 60)}
                              {chunk.content.length > 60 && "..."}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-400">
                              <Zap className="h-2.5 w-2.5" />
                              {chunk.token_count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-center text-xs font-medium text-slate-400">
                    청크 정보를 불러올 수 없습니다
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quiz Title */}
        <div className="space-y-3">
          <label htmlFor="quiz-title" className="ml-1 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Type className="h-4 w-4 text-slate-400" />
            퀴즈 제목
          </label>
          <input
            id="quiz-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              documentId && documents
                ? `${documents.find((d) => d.id === documentId)?.title ?? ""} 퀴즈`
                : "문서를 선택하면 자동으로 지정됩니다"
            }
            maxLength={500}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium transition-all placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <p className="ml-1 text-[11px] font-medium text-slate-400">비워두면 문서 제목 기반으로 자동 생성됩니다</p>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="group relative flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                퀴즈 생성하기
                <Sparkles className="h-4 w-4 transition-transform group-hover:scale-125 group-hover:rotate-12" />
              </>
            )}
          </button>
          {isPending && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
            >
              취소
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
