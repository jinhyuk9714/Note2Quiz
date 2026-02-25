"use client";

import { useState } from "react";
import { ChevronDown, Hash, Zap } from "lucide-react";
import type { Chunk } from "@/types/api";
import { cn } from "@/lib/utils";

interface ChunkViewerProps {
  chunks: Chunk[];
}

export function ChunkViewer({ chunks }: ChunkViewerProps) {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const allExpanded = expandedSet.size === chunks.length;

  function toggle(index: number) {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedSet(new Set());
    } else {
      setExpandedSet(new Set(chunks.map((_, i) => i)));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Hash className="h-5 w-5 text-indigo-600" />
          문서 내용
          <span className="text-sm font-medium text-slate-400">
            {chunks.length}개 섹션
          </span>
        </h3>
        <button
          onClick={toggleAll}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {allExpanded ? "모두 접기" : "모두 펼치기"}
        </button>
      </div>

      <div className="space-y-2">
        {chunks.map((chunk, i) => {
          const isExpanded = expandedSet.has(i);
          return (
            <div
              key={chunk.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <button
                onClick={() => toggle(i)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">
                    {chunk.index + 1}
                  </span>
                  {!isExpanded && (
                    <span className="truncate text-sm text-slate-500">
                      {chunk.content.slice(0, 80)}
                      {chunk.content.length > 80 && "..."}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <Zap className="h-3 w-3" />
                    {chunk.token_count}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-400 transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {chunk.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
