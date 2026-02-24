import type { Metadata } from "next";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizNote AI",
  description: "강의자료 기반 퀴즈 자동 생성 + 오답노트 학습",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="flex h-screen bg-gray-50 text-gray-900 antialiased">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
