"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-center">
      <p className="text-6xl font-bold text-red-100">!</p>
      <h1 className="text-xl font-semibold text-gray-800">
        오류가 발생했습니다
      </h1>
      <p className="text-sm text-gray-500">
        {error.message || "예기치 않은 오류가 발생했습니다. 다시 시도해 주세요."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        다시 시도
      </button>
    </div>
  );
}
