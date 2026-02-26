"use client";

import Link from "next/link";
import { Clock, FileText, Sparkles, ArrowRight, BookMarked } from "lucide-react";

import type { RecentActivityItem } from "@/types/api";

interface RecentActivityCardProps {
  activities: RecentActivityItem[];
}

const TYPE_CONFIG = {
  document_uploaded: {
    icon: FileText,
    color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    href: (id: string) => `/documents/${id}`,
    label: "문서 업로드",
  },
  quiz_attempted: {
    icon: Sparkles,
    color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    href: (id: string) => `/quiz/${id}`,
    label: "퀴즈 풀기",
  },
  wrong_note_created: {
    icon: BookMarked,
    color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
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
    <div className="bento-card p-10 hover:border-indigo-400/50">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-text-primary">
              최근 활동
            </h2>
            <p className="text-sm font-medium text-text-tertiary">나의 최근 학습 내역을 확인하세요.</p>
          </div>
        </div>
        {activities.length > 0 && (
          <span className="rounded-xl bg-surface-alt px-4 py-2 text-xs font-black uppercase tracking-widest text-text-secondary border border-border-default shadow-sm">
            {activities.length} Items
          </span>
        )}
      </div>

      {activities.length > 0 ? (
        <ul className="space-y-3">
          {activities.map((activity, idx) => {
            const config =
              TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.document_uploaded;
            const Icon = config.icon;
            const href = config.href(activity.entity_id);

            return (
              <li key={`${activity.type}-${activity.entity_id}-${idx}`}>
                <Link
                  href={href}
                  className="group flex items-center gap-5 rounded-2xl border border-border-default bg-surface-alt px-6 py-5 transition-all hover:border-indigo-300 hover:bg-surface-card hover:shadow-md"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.color} shadow-sm`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-text-primary group-hover:text-indigo-600 transition-colors">
                      {activity.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs font-bold text-text-tertiary uppercase tracking-wider">
                      <span className="text-indigo-500">{config.label}</span>
                      <span>·</span>
                      <span className="truncate normal-case tracking-normal font-medium">{activity.description}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs font-black text-text-tertiary uppercase tracking-widest">
                      {formatRelativeTime(activity.created_at)}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-card border border-border-default text-text-tertiary transition-all group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200">
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border-default rounded-3xl bg-surface-alt">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-card text-text-tertiary shadow-sm">
            <Clock className="h-8 w-8" />
          </div>
          <p className="text-lg font-black text-text-primary">
            아직 활동이 없습니다
          </p>
          <p className="mt-2 text-sm font-medium text-text-secondary">
            문서를 업로드하거나 퀴즈를 풀어보세요.
          </p>
        </div>
      )}
    </div>
  );
}
