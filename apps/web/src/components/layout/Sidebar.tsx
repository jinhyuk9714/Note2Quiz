"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Brain } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl md:flex md:flex-col">
      <div className="flex h-16 items-center px-6">
        <Link 
          href="/" 
          className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 transition-transform hover:scale-[1.02] active:scale-95"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-1 ring-black/5">
            <Brain className="h-5 w-5" />
          </div>
          Note2Quiz
        </Link>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-inset ring-indigo-100 dark:ring-indigo-800"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="m-3 mt-auto flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 ring-1 ring-inset ring-slate-200/50 dark:ring-slate-700/50 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50">
          <Link href="/settings" className="flex flex-1 items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 text-indigo-700 dark:text-indigo-400 font-bold shadow-sm ring-1 ring-black/5">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                {user.display_name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </Link>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-red-600 dark:hover:text-red-400"
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
