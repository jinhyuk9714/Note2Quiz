import type { Metadata } from "next";
import { Providers } from "./providers";
import { AuthGuard } from "@/components/layout/AuthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Note2Quiz",
  description: "강의자료 기반 퀴즈 자동 생성 + 오답노트 학습",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="h-screen bg-surface text-text-primary antialiased selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-800 dark:selection:text-indigo-200">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
        >
          본문으로 건너뛰기
        </a>
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
