"use client";

import { ArrowUpDown } from "lucide-react";

export interface SortOption {
  value: string;
  label: string;
}

interface SortSelectProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SortSelect({ options, value, onChange }: SortSelectProps) {
  return (
    <div className="relative">
      <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-2xl border border-border-default bg-surface-alt/50 pl-9 pr-8 text-xs font-bold text-text-secondary transition-all focus:border-indigo-500 focus:bg-surface-card focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
