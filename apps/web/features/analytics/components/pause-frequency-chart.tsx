"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PauseFrequencyPoint } from "../types";
import { axisProps, chartColors, gridProps, tooltipStyle } from "./chart-theme";

interface Props {
  data: PauseFrequencyPoint[];
}

export function PauseFrequencyChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pauseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.warning} stopOpacity={0.45} />
            <stop offset="100%" stopColor={chartColors.warning} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="segment" {...axisProps} tick={{ fontSize: 11 }} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [value, "Pauses"]}
        />
        <Area
          type="monotone"
          dataKey="pauses"
          stroke={chartColors.warning}
          strokeWidth={2}
          fill="url(#pauseGradient)"
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
