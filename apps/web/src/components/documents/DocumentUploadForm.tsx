"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileUp, Type, X, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { listFolders, uploadDocument, uploadDocumentFile } from "@/lib/api";
import { cn } from "@/lib/utils";

type UploadMode = "text" | "pdf" | "image";

const IMAGE_ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

function clearFileInput(ref: React.RefObject<HTMLInputElement | null>) {
  if (ref.current) ref.current.value = "";
}

interface DocumentUploadFormProps {
  defaultFolderId?: string | null;
}

export function DocumentUploadForm({ defaultFolderId }: DocumentUploadFormProps) {
  const [mode, setMode] = useState<UploadMode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: folders } = useQuery({
    queryKey: ["folders"],
    queryFn: listFolders,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const folder = folderId || undefined;
      if ((mode === "pdf" || mode === "image") && file) {
        return uploadDocumentFile(title, file, folder);
      }
      return uploadDocument(title, text, folder);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      setTitle("");
      setText("");
      setFile(null);
      clearFileInput(fileInputRef);
      toast.success(`업로드 완료! (${data.chunk_count}개 섹션 생성)`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    (mode === "text" ? text.trim().length >= 10 : file !== null);

  function switchMode(newMode: UploadMode) {
    setMode(newMode);
    setFile(null);
    clearFileInput(fileInputRef);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (mode === "pdf" && selected.type !== "application/pdf") {
      setFile(null);
      return;
    }
    if (mode === "image" && !IMAGE_ACCEPT_TYPES.includes(selected.type)) {
      setFile(null);
      return;
    }
    setFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    if (mode === "pdf" && dropped.type === "application/pdf") {
      setFile(dropped);
    } else if (mode === "image" && IMAGE_ACCEPT_TYPES.includes(dropped.type)) {
      setFile(dropped);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
      className="bento-card overflow-hidden p-10 hover:border-indigo-400/50"
    >
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
          <Upload className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-text-primary">문서 업로드</h2>
          <p className="text-sm font-medium text-text-tertiary">새로운 학습 자료를 분석하여 퀴즈를 생성합니다.</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <label htmlFor="doc-title" className="ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">
              문서 제목
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="강의 제목 또는 노트 이름"
              maxLength={500}
              className="w-full rounded-2xl border border-border-default bg-surface-alt px-5 py-4 text-sm font-bold transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 placeholder:text-text-tertiary text-text-primary"
            />
          </div>

          {/* Folder selector */}
          {folders && folders.length > 0 && (
            <div className="space-y-3">
              <label htmlFor="doc-folder" className="ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">
                폴더 <span className="font-medium opacity-50">(선택)</span>
              </label>
              <select
                id="doc-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-2xl border border-border-default bg-surface-alt px-5 py-4 text-sm font-bold transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 text-text-primary appearance-none cursor-pointer"
              >
                <option value="">미분류</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji ? `${f.emoji} ` : ""}{f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex p-1.5 gap-2 rounded-2xl bg-surface-alt ring-1 ring-inset ring-border-default max-w-md">
          {(["text", "pdf", "image"] as UploadMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                mode === m
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                  : "text-text-tertiary hover:text-text-primary hover:bg-surface-card"
              )}
            >
              {m === "text" && <Type className="h-4 w-4" />}
              {m === "pdf" && <FileUp className="h-4 w-4" />}
              {m === "image" && <ImageIcon className="h-4 w-4" />}
              {m === "text" ? "텍스트" : m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Text mode */}
        {mode === "text" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <label htmlFor="doc-text" className="ml-1 text-xs font-black uppercase tracking-widest text-text-tertiary">
              학습 자료 본문
            </label>
            <textarea
              id="doc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="강의 노트 또는 학습 자료 텍스트를 붙여넣으세요 (최소 10자)"
              rows={12}
              className="w-full rounded-3xl border border-border-default bg-surface-alt px-6 py-6 text-base font-medium transition-all focus:border-indigo-600 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-600/10 placeholder:text-text-tertiary text-text-primary leading-relaxed"
            />
            <div className="flex justify-end pr-4">
              <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{text.length} characters</p>
            </div>
          </div>
        )}

        {/* PDF mode */}
        {mode === "pdf" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border-default p-16 text-center transition-all animate-in fade-in slide-in-from-top-2 duration-300",
              file ? "bg-indigo-50/50 border-indigo-400 dark:bg-indigo-900/10" : "bg-surface-alt hover:border-indigo-400 hover:bg-surface-card"
            )}
          >
            {file ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-card text-indigo-600 shadow-xl shadow-indigo-100 dark:shadow-none">
                  <FileText className="h-10 w-10" />
                </div>
                <div>
                  <p className="text-lg font-black text-text-primary">{file.name}</p>
                  <p className="text-xs font-bold text-text-tertiary mt-1 uppercase tracking-widest">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    clearFileInput(fileInputRef);
                  }}
                  className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                  파일 제거
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-card text-text-tertiary transition-all duration-300 group-hover:scale-110 group-hover:text-indigo-600 group-hover:shadow-xl group-hover:shadow-indigo-100 dark:group-hover:shadow-none">
                  <FileUp className="h-10 w-10" />
                </div>
                <p className="mb-2 text-lg font-black text-text-primary tracking-tight">
                  PDF 파일을 드래그하거나 선택하세요
                </p>
                <p className="mb-8 text-sm font-medium text-text-tertiary uppercase tracking-widest">
                  Maximum 20MB
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 dark:shadow-none active:scale-95"
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

        {/* Image mode */}
        {mode === "image" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border-default p-16 text-center transition-all animate-in fade-in slide-in-from-top-2 duration-300",
              file ? "bg-indigo-50/50 border-indigo-400 dark:bg-indigo-900/10" : "bg-surface-alt hover:border-indigo-400 hover:bg-surface-card"
            )}
          >
            {file ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-card text-indigo-600 shadow-xl shadow-indigo-100 dark:shadow-none">
                  <ImageIcon className="h-10 w-10" />
                </div>
                <div>
                  <p className="text-lg font-black text-text-primary">{file.name}</p>
                  <p className="text-xs font-bold text-text-tertiary mt-1 uppercase tracking-widest">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    clearFileInput(fileInputRef);
                  }}
                  className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                  파일 제거
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-card text-text-tertiary transition-all duration-300 group-hover:scale-110 group-hover:text-indigo-600 group-hover:shadow-xl group-hover:shadow-indigo-100 dark:group-hover:shadow-none">
                  <ImageIcon className="h-10 w-10" />
                </div>
                <p className="mb-2 text-lg font-black text-text-primary tracking-tight">
                  이미지 파일을 드래그하거나 선택하세요
                </p>
                <p className="mb-8 text-sm font-medium text-text-tertiary uppercase tracking-widest">
                  JPG, PNG, WEBP (Max 20MB)
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 dark:shadow-none active:scale-95"
                >
                  파일 선택하기
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
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
          className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-300 disabled:opacity-50 dark:shadow-none active:scale-[0.98]"
        >
          {mutation.isPending ? (
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          ) : (
            <>
              분석 및 퀴즈 생성하기
              <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12 group-hover:scale-125" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
