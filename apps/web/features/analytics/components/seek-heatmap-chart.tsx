"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeekHeatmapBin } from "../types";
import { axisProps, gridProps, tooltipStyle } from "./chart-theme";

interface Props {
  data: SeekHeatmapBin[];
}

function heatColor(value: number, max: number): string {
  const t = max > 0 ? value / max : 0;
  // blue → amber → rose intensity
  if (t < 0.33) return `hsla(221, 83%, ${55 - t * 20}%, ${0.35 + t})`;
  if (t < 0.66) return `hsla(38, 92%, ${50 - (t - 0.33) * 15}%, ${0.5 + t * 0.3})`;
  return `hsla(0, 84%, ${55 - (t - 0.66) * 15}%, ${0.7 + t * 0.25})`;
}

export function SeekHeatmapChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.seeks), 1);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="label"
          {...axisProps}
          interval={4}
          tick={{ fontSize: 10 }}
        />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [value, "Seeks"]}
          labelFormatter={(label) => `Time ${label}`}
        />
        <Bar dataKey="seeks" radius={[3, 3, 0, 0]} maxBarSize={14}>
          {data.map((entry, i) => (
            <Cell key={i} fill={heatColor(entry.seeks, max)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
