"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, gridProps, tooltipStyle } from "./chart-theme";

export interface DifficultyBin {
  start: number;
  end: number;
  label: string;
  difficulty: number;
  pause: number;
  seek: number;
  backward: number;
  replay: number;
  revisit: number;
}

interface Props {
  data: DifficultyBin[];
  /** Align marker with HTML5 video currentTime (seconds) */
  currentTime?: number | null;
}

function heatColor(value: number): string {
  const t = Math.max(0, Math.min(1, value));
  if (t < 0.33) return `hsla(142, 60%, ${45 - t * 10}%, ${0.35 + t})`;
  if (t < 0.66) return `hsla(38, 92%, ${52 - (t - 0.33) * 12}%, ${0.55 + t * 0.25})`;
  return `hsla(0, 84%, ${52 - (t - 0.66) * 12}%, ${0.75 + t * 0.2})`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DifficultyTimelineChart({ data, currentTime }: Props) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No behavioral difficulty data yet — generate seeks/pauses while learning.
      </p>
    );
  }

  const marker =
    currentTime != null && Number.isFinite(currentTime)
      ? formatTime(Math.floor(currentTime / 10) * 10)
      : null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" tick={{ fontSize: 10 }} />
        <YAxis
          {...axisProps}
          domain={[0, 1]}
          tickFormatter={(v) => v.toFixed(1)}
          width={32}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number, name: string) => [
            typeof value === "number" ? value.toFixed(2) : value,
            name,
          ]}
          labelFormatter={(label) => `Interval ${label}`}
        />
        {marker && (
          <ReferenceLine
            x={marker}
            stroke="hsl(var(--primary))"
            strokeDasharray="4 4"
            label={{ value: "now", position: "top", fontSize: 10 }}
          />
        )}
        <Bar dataKey="difficulty" name="Difficulty" radius={[3, 3, 0, 0]} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell key={i} fill={heatColor(entry.difficulty)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
