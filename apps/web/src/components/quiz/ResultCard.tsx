"use client";

import { CheckCircle2, XCircle, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResultCardData {
  quiz_item_id: string;
  question: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  grading_method?: string | null;
  concept_tags: string[];
  difficulty: number;
  quiz_type?: string;
  options?: Record<string, string> | null;
}

interface ResultCardProps {
  data: ResultCardData;
  index: number;
}

export function ResultCard({ data, index }: ResultCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border p-6 transition-all",
        data.is_correct
          ? "border-emerald-100 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/10"
          : "border-red-100 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10",
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          data.is_correct ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        )}>
          {data.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-text-primary leading-relaxed">
            <span className="mr-2 text-text-tertiary">Q{index}.</span>
            {data.question}
          </p>

          {(data.concept_tags.length > 0 || data.difficulty > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {data.concept_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md bg-surface-alt px-2 py-0.5 text-[10px] font-bold text-text-secondary ring-1 ring-inset ring-border-default/50"
                >
                  {tag}
                </span>
              ))}
              {data.difficulty > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-200/50 dark:ring-amber-700/50">
                  {"★".repeat(data.difficulty)}
                  {"☆".repeat(Math.max(0, 3 - data.difficulty))}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-card/50 p-3 ring-1 ring-inset ring-border-default/50">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-text-tertiary">My Answer</p>
                {data.grading_method === "semantic" && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-inset ring-violet-200">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI 채점
                  </span>
                )}
              </div>
              <p className={cn("text-sm font-bold", data.is_correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {data.user_answer || "(No Answer)"}
              </p>
            </div>
            {!data.is_correct && (
              <div className="rounded-xl bg-emerald-500/5 dark:bg-emerald-900/10 p-3 ring-1 ring-inset ring-emerald-500/10 dark:ring-emerald-800/30">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60 dark:text-emerald-500 mb-1">Correct Answer</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {data.correct_answer}
                </p>
              </div>
            )}
          </div>

          {data.explanation && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface-alt/50 p-4 ring-1 ring-inset ring-border-default/30">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <div className="text-xs font-medium leading-relaxed text-text-secondary">
                <span className="font-bold text-text-primary">해설: </span>
                {data.explanation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
