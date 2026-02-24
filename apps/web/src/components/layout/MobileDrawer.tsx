"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <Link
            href="/"
            onClick={onClose}
            className="text-lg font-bold text-indigo-600"
          >
            QuizNote
          </Link>
          <button
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="border-t border-gray-200 p-3">
            <p className="truncate text-sm font-medium text-gray-700">
              {user.display_name}
            </p>
            <p className="truncate text-xs text-gray-400">{user.email}</p>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </>
  );
}
