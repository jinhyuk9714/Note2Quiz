"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadDocument } from "@/lib/api";

export function DocumentUploadForm() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => uploadDocument(title, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTitle("");
      setText("");
    },
  });

  const canSubmit = title.trim().length > 0 && text.trim().length >= 10;

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
