"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Files, LayoutGrid, Info } from "lucide-react";
import { listDocuments, listFolders } from "@/lib/api";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { FolderSidebar } from "@/components/documents/FolderSidebar";
import { SearchInput } from "@/components/common/SearchInput";
import { SortSelect } from "@/components/common/SortSelect";
import { Pagination } from "@/components/common/Pagination";

const SORT_OPTIONS = [
  { value: "created_at", label: "최신순" },
  { value: "title", label: "제목순" },
  { value: "char_count", label: "문서 크기순" },
];

const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [offset, setOffset] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: listFolders,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documents", { search, sort_by: sortBy, offset, folder_id: selectedFolderId }],
    queryFn: () =>
      listDocuments({
        search: search || undefined,
        sort_by: sortBy,
        order: sortBy === "title" ? "asc" : "desc",
        limit: PAGE_SIZE,
        offset,
        folder_id: selectedFolderId ?? undefined,
      }),
  });

  const documents = data?.items;
  const total = data?.total ?? 0;

  // Compute total document count across all folders + uncategorized
  const folderDocSum = folders.reduce((sum, f) => sum + f.document_count, 0);

  // Reset pagination on search/sort/folder change
  function handleSearchChange(v: string) {
    setSearch(v);
    setOffset(0);
  }

  function handleSortChange(v: string) {
    setSortBy(v);
    setOffset(0);
  }

  function handleFolderSelect(folderId: string | null) {
    setSelectedFolderId(folderId);
    setOffset(0);
  }

  // Pass the selected folder as default for uploads (only when a specific folder is selected)
  const uploadDefaultFolderId =
    selectedFolderId && selectedFolderId !== "none" ? selectedFolderId : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-20 pt-8 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tighter text-text-primary">
          문서 관리
        </h1>
        <p className="text-lg text-text-secondary font-medium tracking-tight">
          강의 노트를 업로드하고 학습용 퀴즈를 생성하세요.
        </p>
      </div>

      <DocumentUploadForm defaultFolderId={uploadDefaultFolderId} />

      <div className="flex flex-col lg:flex-row gap-10">
        <aside className="lg:w-64 shrink-0">
          <FolderSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelect={handleFolderSelect}
            totalDocCount={folderDocSum}
            uncategorizedCount={0}
          />
        </aside>

        {/* Main content area */}
        <div className="min-w-0 flex-1 space-y-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-text-primary">내 학습 문서</h2>
              {data && (
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest">
                  {total} Items
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="문서 검색..."
              />
              <SortSelect
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={handleSortChange}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface-alt" />
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onSelect={(id) => router.push(`/quiz/generate?document_id=${id}`)}
                  />
                ))}
              </div>
              <div className="pt-4">
                <Pagination
                  total={total}
                  limit={PAGE_SIZE}
                  offset={offset}
                  onChange={setOffset}
                />
              </div>
            </>
          ) : search ? (
            <div className="flex flex-col items-center justify-center bento-card border-dashed p-20 text-center">
              <h3 className="text-xl font-black text-text-primary">&ldquo;{search}&rdquo; 검색 결과가 없습니다</h3>
              <p className="mt-2 text-base font-medium text-text-secondary">
                다른 검색어로 다시 시도해보세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center bento-card border-dashed p-20 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-alt text-text-tertiary">
                <Files className="h-12 w-12" />
              </div>
              <h3 className="text-xl font-black text-text-primary">업로드된 문서가 없습니다</h3>
              <p className="mt-2 text-base font-medium text-text-secondary">
                상단의 업로드 폼을 통해 첫 번째 학습 문서를 추가해보세요.
              </p>
            </div>
          )}

          <div className="flex items-start gap-4 rounded-3xl bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            <Info className="mt-1 h-6 w-6 shrink-0 text-indigo-200" />
            <div className="space-y-2">
              <p className="text-lg font-black tracking-tight">문서 분석 안내</p>
              <p className="text-sm font-medium leading-relaxed text-indigo-100/90">
                업로드된 문서는 AI가 내용의 핵심을 파악하기 위해 여러 개의 섹션으로 나뉩니다.
                최소 200자 이상의 본문이 포함된 자료가 퀴즈 생성 품질에 더 좋습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
