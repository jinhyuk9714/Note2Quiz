"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { updateProfile, changePassword, deleteAccount, clearToken } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();

  // Profile
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ display_name: displayName.trim() }),
    onSuccess: async () => {
      await refreshUser();
      toast.success("프로필이 업데이트되었습니다");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("비밀번호가 변경되었습니다");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount({ password: deletePassword }),
    onSuccess: () => {
      clearToken();
      logout();
      router.replace("/login");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const canSubmitProfile =
    displayName.trim().length > 0 && displayName.trim() !== user?.display_name;
  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          설정
        </h1>
        <p className="text-sm font-medium text-slate-500">
          프로필 정보와 계정을 관리하세요.
        </p>
      </div>

      {/* Profile Info */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
        <div className="mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">프로필 정보</h2>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            이메일
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="display_name"
            className="mb-1 block text-sm font-semibold text-slate-700"
          >
            표시 이름
          </label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button
          onClick={() => profileMutation.mutate()}
          disabled={!canSubmitProfile || profileMutation.isPending}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {profileMutation.isPending ? "저장 중..." : "프로필 저장"}
        </button>
      </section>

      {/* Password Change */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
        <div className="mb-6 flex items-center gap-2">
          <Lock className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">비밀번호 변경</h2>
        </div>

        <div className="mb-4">
          <label
            htmlFor="current_password"
            className="mb-1 block text-sm font-semibold text-slate-700"
          >
            현재 비밀번호
          </label>
          <input
            id="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="new_password"
            className="mb-1 block text-sm font-semibold text-slate-700"
          >
            새 비밀번호
          </label>
          <input
            id="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8자 이상"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="confirm_password"
            className="mb-1 block text-sm font-semibold text-slate-700"
          >
            새 비밀번호 확인
          </label>
          <input
            id="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 ${
              passwordMismatch
                ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
            }`}
          />
          {passwordMismatch && (
            <p className="mt-1 text-xs font-medium text-red-600">
              비밀번호가 일치하지 않습니다.
            </p>
          )}
        </div>

        <button
          onClick={() => passwordMutation.mutate()}
          disabled={!canSubmitPassword || passwordMutation.isPending}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {passwordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </section>

      {/* Danger Zone */}
      <section className="rounded-2xl bg-red-50/50 p-6 ring-1 ring-red-200/60">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-bold text-red-800">위험 구역</h2>
        </div>
        <p className="mb-4 text-sm text-red-700/80">
          계정을 삭제하면 모든 문서, 퀴즈, 오답노트가 영구적으로 삭제됩니다. 이
          작업은 되돌릴 수 없습니다.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            계정 삭제
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="delete_password"
                className="mb-1 block text-sm font-semibold text-red-700"
              >
                비밀번호를 입력하세요
              </label>
              <input
                id="delete_password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={!deletePassword || deleteMutation.isPending}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteMutation.isPending ? "삭제 중..." : "영구 삭제"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
