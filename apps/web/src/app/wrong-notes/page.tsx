"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { BookOpenCheck, Filter, LayoutGrid, CalendarCheck, CheckCircle2, Sparkles, PlayCircle } from "lucide-react";
import { listWrongNotes } from "@/lib/api";
import { WrongNoteCard } from "@/components/wrong-notes/WrongNoteCard";
import { ReviewSession } from "@/components/wrong-notes/ReviewSession";
import { SearchInput } from "@/components/common/SearchInput";
import { Pagination } from "@/components/common/Pagination";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 20;

type FilterTab = "all" | "due" | "mastered";

function getInitialTab(searchParams: URLSearchParams): FilterTab {
  const tab = searchParams.get("tab");
  if (tab === "mastered") return "mastered";
  if (tab === "due") return "due";
  return "all";
}

export default function WrongNotesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>(() => getInitialTab(searchParams));
  const [reviewMode, setReviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const isMastered = filter === "mastered";
  const dueOnly = filter === "due";

  const { data, isLoading, error } = useQuery({
    queryKey: ["wrong-notes", { filter, search, offset }],
    queryFn: () =>
      listWrongNotes({
        due_only: dueOnly || undefined,
        is_mastered: isMastered || undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
        sort_by: isMastered ? "created_at" : undefined,
        order: isMastered ? "desc" : undefined,
      }),
  });

  const notes = data?.notes ?? [];
  const total = data?.total ?? 0;

  function handleExitReview() {
    setReviewMode(false);
    void queryClient.invalidateQueries({ queryKey: ["wrong-notes"] });
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setOffset(0);
  }

  function handleFilterChange(tab: FilterTab) {
    setFilter(tab);
    setOffset(0);
  }

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <Filter className="h-3.5 w-3.5" /> },
    { key: "due", label: "Due Now", icon: <CalendarCheck className="h-3.5 w-3.5" /> },
    { key: "mastered", label: "Mastered", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ];

  const subHeading = isMastered
    ? "숙달 완료 아카이브"
    : dueOnly
      ? "복습 대기 중인 문항"
      : "내 오답 보관함";

  const emptyMessage = isMastered
    ? { title: "아직 숙달 완료된 오답노트가 없습니다", description: "복습을 계속하면 여기에 쌓입니다!" }
    : dueOnly
      ? { title: "복습할 문제가 없습니다", description: "모든 복습을 마쳤습니다! 새로운 퀴즈에 도전하여 실력을 쌓아보세요." }
      : { title: "오답노트가 텅 비어있어요", description: "퀴즈를 풀고 틀린 문제가 생기면 AI가 자동으로 오답노트에 추가해드립니다." };

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            오답노트
          </h1>
          <p className="text-slate-500 font-medium">
            틀린 문제를 다시 복습하고 개념을 완벽히 이해하세요.
          </p>
        </div>

        <div className="flex p-1.5 gap-1.5 rounded-2xl bg-slate-100 ring-1 ring-inset ring-slate-200/50 shadow-sm transition-all duration-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                filter === tab.key
                  ? tab.key === "mastered"
                    ? "bg-white text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200"
                    : "bg-white text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200"
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
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              {subHeading}
            </h2>
            {data && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
                {total}개
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="문제 검색..."
            />
            {dueOnly && notes.length > 0 && !reviewMode && (
              <button
                onClick={() => setReviewMode(true)}
                className="flex shrink-0 items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
              >
                <PlayCircle className="h-4 w-4" />
                복습 ({notes.length})
              </button>
            )}
          </div>
        </div>

        {reviewMode && notes.length > 0 ? (
          <ReviewSession notes={notes} onExit={handleExitReview} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-[2rem] bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2.5rem] border border-red-100 bg-red-50 p-8 text-center text-sm font-bold text-red-600">
            {error instanceof Error ? error.message : "오류가 발생했습니다"}
          </div>
        ) : notes.length === 0 ? (
          search ? (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-20 text-center backdrop-blur-sm">
              <h3 className="text-lg font-bold text-slate-800">&ldquo;{search}&rdquo; 검색 결과가 없습니다</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                다른 검색어로 다시 시도해보세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-20 text-center backdrop-blur-sm">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
                <BookOpenCheck className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {emptyMessage.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">
                {emptyMessage.description}
              </p>
              {!isMastered && (
                <Link
                  href="/quiz/generate"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <Sparkles className="h-4 w-4" />
                  새로운 퀴즈 시작하기
                </Link>
              )}
            </div>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6">
              {notes.map((note) => (
                <WrongNoteCard key={note.id} note={note} />
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
