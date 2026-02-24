"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Brain, Mail, Lock, User, ArrowRight, AlertCircle } from "lucide-react";

import { signup } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await signup({ email, display_name: displayName, password });
      setToken(data.access_token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-white">
            <Brain className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">QuizNote AI</h1>
          <p className="mt-2 text-slate-500 font-medium">새로운 학습 여정을 시작하세요</p>
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-sm font-bold text-slate-700 ml-1">
                사용자 이름
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="displayName"
                  type="text"
                  required
                  placeholder="홍길동"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 ml-1">
                이메일 주소
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 ml-1">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="8자 이상 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 ring-1 ring-inset ring-red-200/50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? "가입 중..." : "회원가입"}
              {!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <div className="mt-10 border-t border-slate-100 pt-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
