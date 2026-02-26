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
    <aside className="hidden w-72 shrink-0 border-r border-border-default glass-effect md:flex md:flex-col">
      <div className="flex h-20 items-center px-8">
        <Link 
          href="/" 
          className="flex items-center gap-3 text-2xl font-black tracking-tighter text-text-primary transition-transform hover:scale-[1.02] active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Brain className="h-6 w-6" />
          </div>
          Note2Quiz
        </Link>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2 px-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all duration-200",
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40"
                  : "text-text-secondary hover:bg-surface-alt hover:text-text-primary",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-white" : "text-text-tertiary group-hover:text-text-primary"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="p-4">
          <div className="flex items-center gap-3 rounded-3xl bg-surface-alt p-4 ring-1 ring-border-default transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
            <Link href="/settings" className="flex flex-1 items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-card text-indigo-600 font-black shadow-sm ring-1 ring-black/5">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="truncate text-sm font-black text-text-primary">
                  {user.display_name}
                </p>
                <p className="truncate text-xs font-medium text-text-tertiary">{user.email}</p>
              </div>
            </Link>
            <div className="flex flex-col gap-1">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="rounded-xl p-2 text-text-tertiary transition-colors hover:bg-surface-card hover:text-red-600"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
