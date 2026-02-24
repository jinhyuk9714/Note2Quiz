"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/Sidebar";

const PUBLIC_PATHS = ["/login", "/signup"];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, isLoading, isPublic, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  // Public pages (login/signup): no sidebar
  if (isPublic) {
    return <>{children}</>;
  }

  // Not logged in — wait for redirect
  if (!user) {
    return null;
  }

  // Authenticated layout
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </>
  );
}
