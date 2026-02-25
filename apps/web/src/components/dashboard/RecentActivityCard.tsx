"use client";

import Link from "next/link";
import { Clock, FileText, Sparkles, ArrowRight } from "lucide-react";

import type { RecentActivityItem } from "@/types/api";

interface RecentActivityCardProps {
  activities: RecentActivityItem[];
}

const TYPE_CONFIG = {
  document_uploaded: {
    icon: FileText,
    color: "bg-blue-50 text-blue-600",
    href: (id: string) => `/documents/${id}`,
    label: "문서 업로드",
  },
  quiz_attempted: {
    icon: Sparkles,
    color: "bg-indigo-50 text-indigo-600",
    href: (id: string) => `/quiz/${id}`,
    label: "퀴즈 풀기",
  },
  wrong_note_created: {
    icon: FileText,
    color: "bg-amber-50 text-amber-600",
    href: () => "/wrong-notes",
    label: "오답노트",
  },
} as const;

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Clock className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-800">
          최근 활동
        </h2>
        {activities.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200/50">
            {activities.length}개
          </span>
        )}
      </div>

      {activities.length > 0 ? (
        <ul className="space-y-2">
          {activities.map((activity, idx) => {
            const config =
              TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.document_uploaded;
            const Icon = config.icon;
            const href = config.href(activity.entity_id);

            return (
              <li key={`${activity.type}-${activity.entity_id}-${idx}`}>
                <Link
                  href={href}
                  className="group flex items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-all hover:border-slate-200 hover:bg-slate-50"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-700 group-hover:text-slate-900">
                      {activity.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-medium">{config.label}</span>
                      <span>·</span>
                      <span>{activity.description}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">
                      {formatRelativeTime(activity.created_at)}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Clock className="h-7 w-7" />
          </div>
          <p className="text-sm font-bold text-slate-400">
            아직 활동이 없습니다
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            문서를 업로드하거나 퀴즈를 풀어보세요.
          </p>
        </div>
      )}
    </div>
  );
}
