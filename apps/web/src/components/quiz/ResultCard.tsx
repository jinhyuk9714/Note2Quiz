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
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-red-100 bg-red-50/30",
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          data.is_correct ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
        )}>
          {data.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-slate-800 leading-relaxed">
            <span className="mr-2 text-slate-400">Q{index}.</span>
            {data.question}
          </p>

          {(data.concept_tags.length > 0 || data.difficulty > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {data.concept_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50"
                >
                  {tag}
                </span>
              ))}
              {data.difficulty > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-200/50">
                  {"★".repeat(data.difficulty)}
                  {"☆".repeat(Math.max(0, 3 - data.difficulty))}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/50 p-3 ring-1 ring-inset ring-slate-200/50">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">My Answer</p>
                {data.grading_method === "semantic" && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 ring-1 ring-inset ring-violet-200">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI 채점
                  </span>
                )}
              </div>
              <p className={cn("text-sm font-bold", data.is_correct ? "text-emerald-600" : "text-red-600")}>
                {data.user_answer || "(No Answer)"}
              </p>
            </div>
            {!data.is_correct && (
              <div className="rounded-xl bg-emerald-500/5 p-3 ring-1 ring-inset ring-emerald-500/10">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60 mb-1">Correct Answer</p>
                <p className="text-sm font-bold text-emerald-700">
                  {data.correct_answer}
                </p>
              </div>
            )}
          </div>

          {data.explanation && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100/50 p-4 ring-1 ring-inset ring-slate-200/30">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="text-xs font-medium leading-relaxed text-slate-500">
                <span className="font-bold text-slate-700">해설: </span>
                {data.explanation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
