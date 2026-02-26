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
      <body className="flex h-screen bg-surface text-text-primary antialiased selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-800 dark:selection:text-indigo-200">
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
