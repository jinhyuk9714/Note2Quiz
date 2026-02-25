"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerateQuizPayload, QuizStreamProgress } from "@/types/api";
import { generateQuizStream } from "@/lib/api";

interface QuizGenerateStreamState {
  status: "idle" | "streaming" | "error";
  progress: QuizStreamProgress | null;
  errorMessage: string | null;
}

interface UseQuizGenerateStreamReturn {
  state: QuizGenerateStreamState;
  startGeneration: (payload: GenerateQuizPayload) => void;
  cancel: () => void;
}

const INITIAL_STATE: QuizGenerateStreamState = {
  status: "idle",
  progress: null,
  errorMessage: null,
};

export function useQuizGenerateStream(): UseQuizGenerateStreamReturn {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<QuizGenerateStreamState>(INITIAL_STATE);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const startGeneration = useCallback(
    (payload: GenerateQuizPayload) => {
      abortRef.current?.abort();

      setState({ status: "streaming", progress: null, errorMessage: null });

      const controller = generateQuizStream(payload, {
        onProgress: (data) => {
          setState((prev) => ({ ...prev, progress: data }));
        },
        onComplete: (data) => {
          abortRef.current = null;
          setState(INITIAL_STATE);
          router.push(`/quiz/${data.quiz_id}`);
        },
        onError: (message) => {
          abortRef.current = null;
          setState({ status: "error", progress: null, errorMessage: message });
        },
      });

      abortRef.current = controller;
    },
    [router],
  );

  return { state, startGeneration, cancel };
}
