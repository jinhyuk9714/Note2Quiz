"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadDocument, uploadDocumentFile } from "@/lib/api";

type UploadMode = "text" | "pdf";

export function DocumentUploadForm() {
  const [mode, setMode] = useState<UploadMode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "pdf" && file) {
        return uploadDocumentFile(title, file);
      }
      return uploadDocument(title, text);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTitle("");
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    (mode === "text" ? text.trim().length >= 10 : file !== null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== "application/pdf") {
      setFile(null);
      return;
    }
    setFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold">문서 업로드</h2>

      <div>
        <label htmlFor="doc-title" className="mb-1 block text-sm font-medium">
          제목
        </label>
        <input
          id="doc-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="강의 제목 또는 노트 이름"
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`px-3 py-2 text-sm font-medium ${
            mode === "text"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          텍스트 붙여넣기
        </button>
        <button
          type="button"
          onClick={() => setMode("pdf")}
          className={`px-3 py-2 text-sm font-medium ${
            mode === "pdf"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          PDF 업로드
        </button>
      </div>

      {/* Text mode */}
      {mode === "text" && (
        <div>
          <label htmlFor="doc-text" className="mb-1 block text-sm font-medium">
            텍스트
          </label>
          <textarea
            id="doc-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="강의 노트 또는 학습 자료 텍스트를 붙여넣으세요 (최소 10자)"
            rows={12}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">{text.length}자</p>
        </div>
      )}

      {/* PDF mode */}
      {mode === "pdf" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-400"
        >
          <p className="mb-2 text-sm text-gray-600">
            PDF 파일을 드래그하거나 선택하세요
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-700">
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>
      )}

      {mutation.isError && (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      )}

      {mutation.isSuccess && (
        <p className="text-sm text-green-600">
          업로드 완료! ({mutation.data.chunk_count}개 청크 생성)
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || mutation.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "업로드 중..." : "업로드"}
      </button>
    </form>
  );
}
