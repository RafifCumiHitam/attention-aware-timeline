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
import type { WatchTimePoint } from "../types";
import { axisProps, gridProps, palette, tooltipStyle } from "./chart-theme";

interface Props {
  data: WatchTimePoint[];
}

export function WatchTimeChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid {...gridProps} horizontal={false} vertical />
        <XAxis type="number" {...axisProps} unit="m" />
        <YAxis
          type="category"
          dataKey="module"
          width={120}
          {...axisProps}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(value: number) => [`${value} min`, "Watch time"]}
        />
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
