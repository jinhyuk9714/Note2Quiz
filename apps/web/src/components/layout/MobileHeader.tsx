"use client";

import Link from "next/link";
import { Menu, Brain } from "lucide-react";

interface MobileHeaderProps {
  onOpen: () => void;
}

export function MobileHeader({ onOpen }: MobileHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-4 md:hidden sticky top-0 z-30">
      <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-1 ring-black/5">
          <Brain className="h-4 w-4" />
        </div>
        Note2Quiz
      </Link>
      <button
        onClick={onOpen}
        aria-label="메뉴 열기"
        className="rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 active:scale-90"
      >
        <Menu size={20} />
      </button>
    </header>
  );
}
