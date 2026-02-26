"use client";

import Link from "next/link";
import { Menu, Brain } from "lucide-react";

interface MobileHeaderProps {
  onOpen: () => void;
}

export function MobileHeader({ onOpen }: MobileHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default glass-effect px-5 md:hidden sticky top-0 z-30">
      <Link href="/" className="flex items-center gap-3 text-xl font-black tracking-tighter text-text-primary">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none">
          <Brain className="h-5 w-5" />
        </div>
        Note2Quiz
      </Link>
      <button
        onClick={onOpen}
        aria-label="메뉴 열기"
        className="rounded-xl p-2.5 text-text-secondary transition-colors hover:bg-surface-alt active:scale-95"
      >
        <Menu size={24} />
      </button>
    </header>
  );
}
