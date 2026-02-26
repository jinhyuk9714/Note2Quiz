"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Sparkles, RefreshCw } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onDismiss: () => void;
  userName: string;
}

const steps = [
  {
    icon: FileUp,
    title: "문서 업로드",
    description: "PDF나 텍스트 강의자료를 업로드하세요.",
    color: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
  {
    icon: Sparkles,
    title: "AI 퀴즈 생성",
    description: "AI가 자동으로 고품질 문제를 만들어요.",
    color: "bg-purple-50 text-purple-600 ring-purple-100",
  },
  {
    icon: RefreshCw,
    title: "오답노트 복습",
    description: "틀린 문제를 반복 학습으로 완전히 익혀요.",
    color: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
];

export function OnboardingModal({
  open,
  onDismiss,
  userName,
}: OnboardingModalProps) {
  const router = useRouter();
  const dismissRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    },
    [onDismiss],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    dismissRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleStart = () => {
    onDismiss();
    router.push("/documents");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onDismiss}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl animate-in zoom-in-95 fade-in duration-200"
      >
        <h2
          id="onboarding-title"
          className="text-xl font-extrabold tracking-tight text-slate-800"
        >
          {userName}님, 환영합니다!
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          퀴즈노트 AI로 학습하는 3단계를 소개할게요.
        </p>

        <ol className="mt-6 space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${step.color}`}
              >
                <step.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">
                  <span className="text-slate-400 mr-1.5">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex justify-end gap-2">
          <button
            ref={dismissRef}
            onClick={onDismiss}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            나중에 보기
          </button>
          <button
            onClick={handleStart}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
