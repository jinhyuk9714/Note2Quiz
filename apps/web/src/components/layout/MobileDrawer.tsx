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
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface border-r border-border-default shadow-2xl transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-border-default px-6">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 text-2xl font-black tracking-tighter text-text-primary"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none">
              <Brain className="h-6 w-6" />
            </div>
            Note2Quiz
          </Link>
          <button
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="rounded-xl p-2.5 text-text-tertiary hover:bg-surface-alt hover:text-text-primary transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-2 px-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-base font-bold transition-all duration-200",
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
          <div className="m-4 mt-auto rounded-3xl bg-surface-alt p-5 ring-1 ring-inset ring-border-default">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-card text-indigo-600 font-black shadow-sm ring-1 ring-black/5">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="truncate text-base font-black text-text-primary">
                  {user.display_name}
                </p>
                <p className="truncate text-xs font-medium text-text-tertiary">{user.email}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center justify-center rounded-xl bg-surface-card py-1 border border-border-default shadow-sm">
                <ThemeToggle />
              </div>
              <button
                onClick={handleLogout}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-card border border-border-default py-3 text-xs font-black text-text-secondary transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 shadow-sm"
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
