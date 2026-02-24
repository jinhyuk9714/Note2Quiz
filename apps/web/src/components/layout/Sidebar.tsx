"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
    <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="text-lg font-bold text-indigo-600">
          QuizNote
        </Link>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
    </aside>
  );
}
