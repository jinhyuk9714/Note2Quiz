"use client";

import Link from "next/link";
import { X, Brain, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NAV_ITEMS } from "./nav-items";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    onClose();
    router.replace("/login");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-800"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-1 ring-black/5">
              <Brain className="h-5 w-5" />
            </div>
            Note2Quiz
          </Link>
          <button
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1.5 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="m-4 mt-auto rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold shadow-sm ring-1 ring-black/5">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="truncate text-sm font-bold text-slate-700">
                  {user.display_name}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <ThemeToggle className="flex-none" />
              <button
                onClick={handleLogout}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800"
              >
                <LogOut size={14} />
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
