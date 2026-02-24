import type { SubmitResult, QuizItem as QuizItemType } from "@/types/api";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, Trophy, Target, Brain } from "lucide-react";

interface QuizResultsProps {
  result: SubmitResult;
  items: QuizItemType[];
}

export function QuizResults({ result, items }: QuizResultsProps) {
  const percentage = Math.round((result.score / result.total) * 100);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Score summary */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 backdrop-blur-md ring-1 ring-white/10">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Quiz Completed</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-7xl font-black tracking-tighter text-white">{result.score}</span>
            <span className="text-2xl font-bold text-slate-500">/ {result.total}</span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex h-2 w-48 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-sm font-bold text-slate-400">{percentage}% Accuracy</p>
          </div>

          {result.wrong_notes_created > 0 && (
            <div className="mt-8 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 ring-1 ring-inset ring-amber-500/20">
              <Brain className="h-3.5 w-3.5" />
              {result.wrong_notes_created}개의 오답노트가 생성되었습니다
            </div>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/20 blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[80px]" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 px-1 text-slate-800">
          <Target className="h-5 w-5 text-indigo-600" />
          <h3 className="text-xl font-bold tracking-tight">상세 결과 분석</h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {result.results.map((r, i) => {
            const item = items.find((q) => q.id === r.quiz_item_id);
            return (
              <div
                key={r.quiz_item_id}
                className={cn(
                  "overflow-hidden rounded-[2rem] border p-6 transition-all",
                  r.is_correct
                    ? "border-emerald-100 bg-emerald-50/30"
                    : "border-red-100 bg-red-50/30",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    r.is_correct ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                  )}>
                    {r.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 leading-relaxed">
                      <span className="mr-2 text-slate-400">Q{i + 1}.</span>
                      {item?.question ?? ""}
                    </p>
                    
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/50 p-3 ring-1 ring-inset ring-slate-200/50">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">My Answer</p>
                        <p className={cn("text-sm font-bold", r.is_correct ? "text-emerald-600" : "text-red-600")}>
                          {r.user_answer || "(No Answer)"}
                        </p>
                      </div>
                      {!r.is_correct && (
                        <div className="rounded-xl bg-emerald-500/5 p-3 ring-1 ring-inset ring-emerald-500/10">
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600/60 mb-1">Correct Answer</p>
                          <p className="text-sm font-bold text-emerald-700">
                            {r.correct_answer}
                          </p>
                        </div>
                      )}
                    </div>

                    {(r.explanation || item?.explanation) && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100/50 p-4 ring-1 ring-inset ring-slate-200/30">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div className="text-xs font-medium leading-relaxed text-slate-500">
                          <span className="font-bold text-slate-700">해설: </span>
                          {r.explanation || item?.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
