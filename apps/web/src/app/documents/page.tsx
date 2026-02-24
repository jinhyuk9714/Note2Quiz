"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Files, LayoutGrid, Info } from "lucide-react";
import { listDocuments } from "@/lib/api";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { DocumentCard } from "@/components/documents/DocumentCard";

export default function DocumentsPage() {
  const router = useRouter();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          문서 관리
        </h1>
        <p className="text-slate-500 font-medium">
          강의 노트를 업로드하고 학습용 퀴즈를 생성하세요.
        </p>
      </div>

      <DocumentUploadForm />

      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800">내 학습 문서</h2>
          </div>
          {documents && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
              총 {documents.length}개
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[2rem] bg-slate-100" />
            ))}
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onSelect={(id) => router.push(`/quiz/generate?document_id=${id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 p-16 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
              <Files className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">업로드된 문서가 없습니다</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              상단의 업로드 폼을 통해 첫 번째 학습 문서를 추가해보세요.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/50 p-5 ring-1 ring-inset ring-indigo-100/50">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
          <div className="text-xs font-medium leading-relaxed text-indigo-700/80">
            <p className="font-bold text-indigo-800 mb-1">문서 분석 안내</p>
            업로드된 문서는 AI가 내용의 핵심을 파악하기 위해 여러 개의 청크(Chunk)로 나뉩니다. 
            너무 짧은 문서보다는 최소 200자 이상의 본문이 포함된 자료가 퀴즈 생성 품질에 더 좋습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
