"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, FileText, ListOrdered, CheckSquare, HelpCircle, PenTool, AlertCircle, Type, Layers, Zap, ChevronDown, Target, X } from "lucide-react";
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
      className="bento-card p-10 hover:border-indigo-400/50"
    >
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-text-primary">퀴즈 구성하기</h2>
          <p className="text-sm font-medium text-text-tertiary">학습할 문서와 퀴즈의 형태를 선택하세요.</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Focus Concept Badge */}
        {focusConcept && (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-900/20 px-5 py-4">
            <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">
              집중 개념:
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-bold text-indigo-900 dark:text-indigo-200 shadow-sm ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800">
              {focusConcept}
              <button
                type="button"
                onClick={() => setFocusConcept(null)}
                className="rounded-full p-0.5 text-text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors"
                aria-label="집중 개념 해제"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          </div>
        )}

        {/* Document Selection */}
        <div className="space-y-3">
          <label htmlFor="doc-select" className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-tertiary">
            <FileText className="h-4 w-4 text-indigo-500" />
            학습 문서 선택
          </label>
          {docsLoading ? (
            <div className="h-14 animate-pulse rounded-2xl bg-surface-alt" />
          ) : documents && documents.length > 0 ? (
            <div className="relative">
              <select
                id="doc-select"
                value={documentId}
                onChange={(e) => handleDocumentChange(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-border-default bg-surface-alt px-5 py-4 text-sm font-bold transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 text-text-primary"
              >
                <option value="">문서를 선택하세요</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.char_count.toLocaleString()}자)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-text-tertiary">
                <ChevronDown className="h-5 w-5" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-6">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="space-y-1">
                <p className="text-sm font-black text-amber-900 dark:text-amber-200">업로드된 문서가 없습니다</p>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Link href="/documents" className="underline decoration-2 underline-offset-4 hover:text-indigo-600 transition-colors">
                    먼저 문서를 업로드하세요.
                  </Link>
                </p>
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
              className="group ml-1 flex w-full items-center justify-between text-xs font-black uppercase tracking-widest text-text-tertiary"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-500" />
                <span>범위 선택</span>
                {selectedChunkIds.size > 0 && (
                  <span className="rounded-lg bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-400">
                    {selectedChunkIds.size}/{chunks.length}
                  </span>
                )}
                <span className="font-medium opacity-50">(Optional)</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform group-hover:text-text-primary", chunkSectionOpen && "rotate-180")} />
            </button>

            {chunkSectionOpen && (
              <div className="rounded-3xl border border-border-default bg-surface-alt p-6 animate-in slide-in-from-top-2 duration-300">
                {chunksLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded-2xl bg-surface-card" />
                    ))}
                  </div>
                ) : chunks.length > 0 ? (
                  <>
                    <div className="mb-4 flex items-center justify-between border-b border-border-default pb-4">
                      <p className="text-sm font-bold text-text-secondary">
                        {selectedChunkIds.size > 0
                          ? `${selectedChunkIds.size}/${chunks.length}개 섹션 선택됨`
                          : "선택하지 않으면 전체 문서에서 출제됩니다"}
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={selectAllChunks}
                          className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          전체 선택
                        </button>
                        <span className="text-border-default">|</span>
                        <button
                          type="button"
                          onClick={deselectAllChunks}
                          className="text-xs font-black text-text-tertiary hover:text-text-primary transition-colors"
                        >
                          전체 해제
                        </button>
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                      {chunks.map((chunk) => {
                        const isSelected = selectedChunkIds.has(chunk.id);
                        return (
                          <label
                            key={chunk.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all duration-200",
                              isSelected
                                ? "border-indigo-600 bg-white dark:bg-slate-800 shadow-md shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-600"
                                : "border-border-default bg-surface-card hover:border-indigo-300 hover:bg-surface-alt",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChunk(chunk.id)}
                              className="h-5 w-5 rounded border-border-default text-indigo-600 focus:ring-indigo-500 focus:ring-offset-2 transition-all cursor-pointer"
                            />
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-[10px] font-black text-text-secondary">
                              {chunk.index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                              {chunk.content.slice(0, 80)}
                              {chunk.content.length > 80 && "..."}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-alt px-2.5 py-1 text-[10px] font-black text-text-tertiary">
                              <Zap className="h-3 w-3 text-amber-500" />
                              {chunk.token_count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm font-bold text-text-tertiary">
                    청크 정보를 불러올 수 없습니다
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quiz Title */}
        <div className="space-y-3">
          <label htmlFor="quiz-title" className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-tertiary">
            <Type className="h-4 w-4 text-purple-500" />
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
            className="w-full rounded-2xl border border-border-default bg-surface-alt px-5 py-4 text-sm font-bold transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 text-text-primary placeholder:text-text-tertiary"
          />
          <p className="ml-1 text-[10px] font-black uppercase tracking-widest text-text-tertiary opacity-70">비워두면 문서 제목 기반으로 자동 생성됩니다</p>
        </div>

        {/* Number of Questions */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <label htmlFor="n-questions" className="text-xs font-black uppercase tracking-widest text-text-tertiary">
              문제 수
            </label>
            <span className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-black text-white shadow-md shadow-indigo-200 dark:shadow-none">
              {nQuestions} Questions
            </span>
          </div>
          <div className="px-1 relative">
            <input
              id="n-questions"
              type="range"
              min={1}
              max={20}
              value={nQuestions}
              onChange={(e) => setNQuestions(Number(e.target.value))}
              className="h-3 w-full cursor-pointer appearance-none rounded-full bg-surface-alt border border-border-default accent-indigo-600 focus:outline-none"
            />
            <div className="mt-3 flex justify-between text-[10px] font-black text-text-tertiary uppercase tracking-widest">
              <span>1 Q</span>
              <span>20 Qs</span>
            </div>
          </div>
        </div>

        {/* Quiz Types */}
        <div className="space-y-4">
          <p className="ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">문제 유형 <span className="opacity-50">(중복 선택 가능)</span></p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {QUIZ_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleType(value)}
                className={cn(
                  "group flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all duration-300 active:scale-95",
                  quizTypes.includes(value)
                    ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md shadow-indigo-100/50 dark:shadow-none ring-1 ring-indigo-600"
                    : "border-border-default bg-surface-alt hover:border-indigo-300 hover:bg-surface-card"
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
                  quizTypes.includes(value) ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-800 text-text-tertiary group-hover:text-indigo-600 group-hover:scale-110"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-black transition-colors",
                  quizTypes.includes(value) ? "text-indigo-900 dark:text-indigo-100" : "text-text-secondary group-hover:text-text-primary"
                )}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="group relative flex flex-1 items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-5 text-base font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-300 disabled:opacity-50 disabled:hover:translate-y-0 dark:shadow-none active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                <span>퀴즈를 생성하고 있습니다...</span>
              </>
            ) : (
              <>
                AI 퀴즈 생성 시작
                <Sparkles className="h-5 w-5 transition-transform group-hover:scale-125 group-hover:rotate-12" />
              </>
            )}
          </button>
          {isPending && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-border-default bg-surface-alt px-8 py-5 text-base font-black text-text-secondary transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-[0.98]"
            >
              취소
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
