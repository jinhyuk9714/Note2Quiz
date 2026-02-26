"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Copy, RefreshCw, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getShareInfo, toggleShare, regenerateShareCode } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
  open: boolean;
  quizId: string;
  onClose: () => void;
}

export function ShareDialog(props: ShareDialogProps) {
  if (!props.open) return null;
  return <ShareDialogInner {...props} />;
}

function ShareDialogInner({ quizId, onClose }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const [confirmRegen, setConfirmRegen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data: shareInfo, isLoading } = useQuery({
    queryKey: ["share-info", quizId],
    queryFn: () => getShareInfo(quizId),
  });

  const toggleMutation = useMutation({
    mutationFn: (isShared: boolean) => toggleShare(quizId, isShared),
    onSuccess: (data) => {
      queryClient.setQueryData(["share-info", quizId], data);
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      toast.success(data.is_shared ? "공유가 활성화되었습니다" : "공유가 비활성화되었습니다");
    },
    onError: () => toast.error("공유 설정 변경에 실패했습니다"),
  });

  const regenMutation = useMutation({
    mutationFn: () => regenerateShareCode(quizId),
    onSuccess: (data) => {
      queryClient.setQueryData(["share-info", quizId], data);
      setConfirmRegen(false);
      toast.success("새 공유 링크가 생성되었습니다");
    },
    onError: () => toast.error("링크 재생성에 실패했습니다"),
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCopyLink() {
    if (!shareInfo?.share_url) return;
    try {
      await navigator.clipboard.writeText(shareInfo.share_url);
      toast.success("링크가 복사되었습니다");
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  }

  const isShared = shareInfo?.is_shared ?? false;
  const busy = toggleMutation.isPending || regenMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl animate-in zoom-in-95 fade-in duration-200"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Link2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">퀴즈 공유</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">공유 활성화</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  링크를 아는 누구나 이 퀴즈를 풀 수 있습니다
                </p>
              </div>
              <button
                onClick={() => toggleMutation.mutate(!isShared)}
                disabled={busy}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors duration-200",
                  isShared ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-600",
                  busy && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
                    isShared ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            {/* Share URL */}
            {isShared && shareInfo?.share_url && (
              <>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    공유 링크
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareInfo.share_url}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 font-mono truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      복사
                    </button>
                  </div>
                </div>

                {/* Regenerate */}
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  {confirmRegen ? (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">
                        기존 링크가 무효화됩니다. 계속하시겠습니까?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => regenMutation.mutate()}
                          disabled={regenMutation.isPending}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => setConfirmRegen(false)}
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRegen(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      링크 재생성
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
