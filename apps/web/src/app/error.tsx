"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-red-100 text-red-600 shadow-xl shadow-red-100 ring-4 ring-white animate-pulse">
        <AlertTriangle className="h-12 w-12" />
      </div>
      
      <h1 className="text-3xl font-black tracking-tight text-slate-900">
        문제가 발생했습니다
      </h1>
      <p className="mt-3 text-lg font-medium text-slate-500 max-w-sm">
        {error.message || "시스템에서 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <button
          onClick={reset}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          다시 시도
        </button>
        <Link
          href="/"
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-6 py-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
        >
          <Home className="h-4 w-4" />
          홈으로
        </Link>
      </div>
      
      {error.digest && (
        <p className="mt-8 text-[10px] font-mono text-slate-400">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
