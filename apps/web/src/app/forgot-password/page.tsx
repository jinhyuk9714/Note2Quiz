"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Brain, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";

import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-900/30 ring-4 ring-white dark:ring-surface-card">
            <Brain className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-text-primary">비밀번호 찾기</h1>
          <p className="mt-2 text-text-secondary font-medium">
            가입한 이메일 주소를 입력해 주세요
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-border-default bg-surface-card p-8 shadow-xl sm:p-12">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-text-primary">
                비밀번호 재설정 링크가 이메일로 전송되었습니다.
              </p>
              <p className="text-xs text-text-tertiary">
                이메일을 확인하고 링크를 클릭해 주세요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-bold text-text-secondary ml-1">
                  이메일 주소
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Mail className="h-4 w-4 text-text-tertiary" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-2xl border border-border-default bg-surface-alt/50 py-3.5 pl-11 pr-4 text-sm font-medium text-text-primary transition-all focus:border-indigo-500 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-xs font-bold text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-200/50 dark:ring-red-800/50">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? "전송 중..." : "재설정 링크 보내기"}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
