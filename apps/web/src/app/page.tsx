"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listDocuments, listWrongNotes } from "@/lib/api";

export default function DashboardPage() {
  const { data: documents } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const { data: dueNotes } = useQuery({
    queryKey: ["wrong-notes", true],
    queryFn: () => listWrongNotes(true),
  });

  const docCount = documents?.length ?? 0;
  const dueCount = dueNotes?.total ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">QuizNote AI</h1>
        <p className="mt-1 text-sm text-gray-500">
          강의자료 기반 퀴즈 자동 생성 + 오답노트 학습
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">업로드 문서</p>
          <p className="mt-1 text-3xl font-bold">{docCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">복습 예정</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{dueCount}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">빠른 시작</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/documents"
            className="rounded-lg border border-gray-200 bg-white p-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <p className="text-sm font-medium text-indigo-600">문서 업로드</p>
            <p className="mt-1 text-xs text-gray-500">
              강의 노트를 업로드하세요
            </p>
          </Link>
          <Link
            href="/quiz/generate"
            className="rounded-lg border border-gray-200 bg-white p-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <p className="text-sm font-medium text-indigo-600">퀴즈 생성</p>
            <p className="mt-1 text-xs text-gray-500">
              문서 기반 퀴즈를 만드세요
            </p>
          </Link>
        </div>
      </div>

      {dueCount > 0 && (
        <Link
          href="/wrong-notes"
          className="block rounded-lg border border-amber-200 bg-amber-50 p-4 text-center transition-colors hover:bg-amber-100"
        >
          <p className="text-sm font-medium text-amber-700">
            복습할 오답노트가 {dueCount}개 있어요!
          </p>
        </Link>
      )}
    </div>
  );
}
