"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  History,
  LayoutGrid,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { listDocuments, listQuizzes } from "@/lib/api";
import { QuizHistoryCard } from "@/components/quiz/QuizHistoryCard";
import { SearchInput } from "@/components/common/SearchInput";
import { SortSelect } from "@/components/common/SortSelect";
import { Pagination } from "@/components/common/Pagination";
import { cn } from "@/lib/utils";
import Link from "next/link";

type AttemptTab = "all" | "not_attempted" | "attempted";

const ATTEMPT_TABS: { key: AttemptTab; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "전체", icon: <Filter className="h-3.5 w-3.5" /> },
  { key: "not_attempted", label: "미응시", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "attempted", label: "응시완료", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const SORT_OPTIONS = [
  { value: "created_at", label: "최신순" },
  { value: "title", label: "제목순" },
  { value: "item_count", label: "문항수순" },
  { value: "latest_score", label: "점수순" },
];

const SCORE_OPTIONS = [
  { value: "all", label: "전체 점수" },
  { value: "low", label: "70% 미만" },
  { value: "mid", label: "70~90%" },
  { value: "high", label: "90% 이상" },
];

const SCORE_RANGES: Record<string, { min?: number; max?: number }> = {
  all: {},
  low: { min: 0, max: 70 },
  mid: { min: 70, max: 90 },
  high: { min: 90, max: 101 },
};

const PAGE_SIZE = 20;

export default function QuizHistoryPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [offset, setOffset] = useState(0);
  const [attemptStatus, setAttemptStatus] = useState<AttemptTab>("all");
  const [documentId, setDocumentId] = useState<string>();
  const [scoreRange, setScoreRange] = useState("all");

  const range = SCORE_RANGES[scoreRange] ?? {};

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "quizzes",
      { search, sort_by: sortBy, offset, attemptStatus, documentId, scoreRange },
    ],
    queryFn: () =>
      listQuizzes({
        search: search || undefined,
        sort_by: sortBy,
        order: sortBy === "title" ? "asc" : "desc",
        limit: PAGE_SIZE,
        offset,
        document_id: documentId,
        attempt_status: attemptStatus === "all" ? undefined : attemptStatus,
        score_min: range.min,
        score_max: range.max,
      }),
  });

  const { data: docsData } = useQuery({
    queryKey: ["documents-for-filter"],
    queryFn: () => listDocuments({ limit: 200, sort_by: "title", order: "asc" }),
    staleTime: 5 * 60 * 1000,
  });

  const quizzes = data?.items;
  const total = data?.total ?? 0;

  const hasActiveFilter =
    attemptStatus !== "all" ||
    scoreRange !== "all" ||
    !!documentId ||
    !!search;

  function resetFilters() {
    setAttemptStatus("all");
    setScoreRange("all");
    setDocumentId(undefined);
    setSearch("");
    setOffset(0);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setOffset(0);
  }

  function handleSortChange(v: string) {
    setSortBy(v);
    setOffset(0);
  }

  function handleAttemptStatusChange(tab: AttemptTab) {
    setAttemptStatus(tab);
    setOffset(0);
  }

  function handleDocumentChange(v: string) {
    setDocumentId(v || undefined);
    setOffset(0);
  }

  function handleScoreRangeChange(v: string) {
    setScoreRange(v);
    setOffset(0);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            퀴즈 기록
          </h1>
          <p className="text-slate-500 font-medium">
            지금까지 풀었던 모든 퀴즈 목록을 확인하고 복습하세요.
          </p>
        </div>

        <div className="flex p-1.5 gap-1.5 rounded-2xl bg-slate-100 ring-1 ring-inset ring-slate-200/50 shadow-sm transition-all duration-200">
          {ATTEMPT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleAttemptStatusChange(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                attemptStatus === tab.key
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800">내 퀴즈 보관함</h2>
            {data && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
                {total}개
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {docsData && docsData.items.length > 0 && (
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <select
                  value={documentId ?? ""}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  className="h-11 appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-xs font-bold text-slate-600 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                >
                  <option value="">모든 문서</option>
                  {docsData.items.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <SortSelect
              options={SCORE_OPTIONS}
              value={scoreRange}
              onChange={handleScoreRangeChange}
            />
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="퀴즈 검색..."
            />
            <SortSelect
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={handleSortChange}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[2rem] bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center text-sm font-bold text-red-600">
            {error instanceof Error ? error.message : "오류가 발생했습니다"}
          </div>
        ) : quizzes && quizzes.length === 0 ? (
          hasActiveFilter ? (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-20 text-center backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-800">
                필터 조건에 맞는 퀴즈가 없습니다
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                다른 필터 조건으로 다시 시도해보세요.
              </p>
              <button
                onClick={resetFilters}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-200 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-20 text-center backdrop-blur-sm">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
                <History className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">생성된 퀴즈가 없습니다</h3>
              <p className="mt-2 text-sm font-medium text-slate-500 max-w-xs mx-auto">
                아직 도전한 퀴즈가 없네요! 학습 문서를 업로드하고 첫 번째 퀴즈를 생성해보세요.
              </p>
              <Link
                href="/quiz/generate"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
              >
                <Sparkles className="h-4 w-4" />
                첫 퀴즈 생성하기
              </Link>
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {quizzes?.map((quiz) => (
                <QuizHistoryCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
            <Pagination
              total={total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
            />
          </>
        )}
      </div>
    </div>
  );
}
