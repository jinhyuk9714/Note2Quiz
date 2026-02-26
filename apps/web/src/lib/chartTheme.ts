export const CHART_COLORS = {
  light: {
    grid: "#e2e8f0",
    tick: "#94a3b8",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipText: "#334155",
  },
  dark: {
    grid: "#334155",
    tick: "#94a3b8",
    tooltipBg: "#1e293b",
    tooltipBorder: "#475569",
    tooltipText: "#e2e8f0",
  },
} as const;

export type ChartPalette = (typeof CHART_COLORS)["light"];
