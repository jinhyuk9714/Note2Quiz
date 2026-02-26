"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileUp, Type, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { uploadDocument, uploadDocumentFile } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTitle("");
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`업로드 완료! (${data.chunk_count}개 섹션 생성)`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
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
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Upload className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">문서 업로드</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="doc-title" className="ml-1 text-sm font-bold text-slate-700">
            문서 제목
          </label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="강의 제목 또는 노트 이름"
            maxLength={500}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
          />
        </div>

        {/* Mode tabs */}
        <div className="flex p-1 gap-1 rounded-2xl bg-slate-100 ring-1 ring-inset ring-slate-200/50">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all",
              mode === "text"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Type className="h-4 w-4" />
            텍스트 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => setMode("pdf")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all",
              mode === "pdf"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <FileUp className="h-4 w-4" />
            PDF 업로드
          </button>
        </div>

        {/* Text mode */}
        {mode === "text" && (
          <div className="space-y-2 animate-in fade-in duration-300">
            <label htmlFor="doc-text" className="ml-1 text-sm font-bold text-slate-700">
              학습 자료 본문
            </label>
            <textarea
              id="doc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="강의 노트 또는 학습 자료 텍스트를 붙여넣으세요 (최소 10자)"
              rows={10}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
            />
            <div className="flex justify-end pr-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{text.length} characters</p>
            </div>
          </div>
        )}

        {/* PDF mode */}
        {mode === "pdf" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center transition-all animate-in fade-in duration-300",
              file ? "bg-indigo-50/30 border-indigo-200" : "bg-slate-50/50 hover:border-indigo-300 hover:bg-white"
            )}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{file.name}</p>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                  파일 제거
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-500">
                  <FileUp className="h-8 w-8" />
                </div>
                <p className="mb-1 text-sm font-bold text-slate-700">
                  PDF 파일을 드래그하거나 선택하세요
                </p>
                <p className="mb-6 text-xs font-medium text-slate-400">
                  최대 10MB 크기의 PDF 파일만 가능합니다.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:ring-slate-300 active:scale-95"
                >
                  파일 선택하기
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || mutation.isPending}
          className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 active:scale-[0.98]"
        >
          {mutation.isPending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              업로드 및 분석 시작
              <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
