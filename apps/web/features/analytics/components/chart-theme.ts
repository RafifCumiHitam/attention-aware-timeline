/**
 * Shared Recharts styling that adapts to light/dark via CSS variables.
 * Tailwind sets --foreground, --muted-foreground, --border, --primary on :root / .dark
 */

export const chartColors = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--chart-2, 173 58% 39%))",
  tertiary: "hsl(var(--chart-3, 197 37% 24%))",
  quaternary: "hsl(var(--chart-4, 43 74% 66%))",
  quinary: "hsl(var(--chart-5, 27 87% 67%))",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

export const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 12,
  tickLine: false as const,
  axisLine: false as const,
};

export const gridProps = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
  vertical: false as const,
};

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  },
  labelStyle: {
    color: "hsl(var(--foreground))",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: {
    color: "hsl(var(--muted-foreground))",
  },
};

export const palette = [
  "hsl(221.2 83.2% 53.3%)",
  "hsl(173 58% 39%)",
  "hsl(197 37% 45%)",
  "hsl(43 74% 49%)",
  "hsl(27 87% 55%)",
  "hsl(280 65% 55%)",
];
