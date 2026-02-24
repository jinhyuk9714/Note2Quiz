"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

interface MobileHeaderProps {
  onOpen: () => void;
}

export function MobileHeader({ onOpen }: MobileHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
      <Link href="/" className="text-lg font-bold text-indigo-600">
        QuizNote
      </Link>
      <button
        onClick={onOpen}
        aria-label="메뉴 열기"
        className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
      >
        <Menu size={22} />
      </button>
    </header>
  );
}
