"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = ["system", "light", "dark"] as const;
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;
const LABELS = { system: "시스템", light: "라이트", dark: "다크" } as const;

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          className,
        )}
      />
    );
  }

  const current = (theme ?? "system") as (typeof THEMES)[number];
  const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
  const next = THEMES[nextIndex];
  const Icon = ICONS[current];

  return (
    <button
      onClick={() => setTheme(next)}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl text-text-tertiary transition-all hover:bg-surface hover:text-text-primary active:scale-95",
        className,
      )}
      aria-label={`테마 변경: 현재 ${LABELS[current]}, ${LABELS[next]}(으)로 전환`}
      title={`${LABELS[current]} → ${LABELS[next]}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
