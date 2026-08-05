"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttentionTrendPoint } from "../types";
import { axisProps, chartColors, gridProps, tooltipStyle } from "./chart-theme";

interface Props {
  data: AttentionTrendPoint[];
}

export function AttentionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="attentionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.success} stopOpacity={0.4} />
            <stop offset="100%" stopColor={chartColors.success} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="time" {...axisProps} />
        <YAxis {...axisProps} domain={[50, 100]} unit="%" />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number, name: string) => [
            `${value}%`,
            name === "attention" ? "Attention" : "Baseline",
          ]}
        />
        <ReferenceLine
          y={80}
          stroke={chartColors.muted}
          strokeDasharray="4 4"
          label={{
            value: "Target 80%",
            position: "insideTopRight",
            fill: "hsl(var(--muted-foreground))",
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="attention"
          stroke={chartColors.success}
          strokeWidth={2.5}
          fill="url(#attentionGradient)"
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
