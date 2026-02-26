import {
  LayoutDashboard,
  Files,
  PenTool,
  History,
  RefreshCw,
  BookOpenCheck,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/documents", label: "문서 관리", icon: Files },
  { href: "/quiz/generate", label: "퀴즈 생성", icon: PenTool },
  { href: "/quiz/history", label: "퀴즈 기록", icon: History },
  { href: "/review", label: "복습", icon: RefreshCw },
  { href: "/wrong-notes", label: "오답노트", icon: BookOpenCheck },
  { href: "/settings", label: "설정", icon: Settings },
] as const;
