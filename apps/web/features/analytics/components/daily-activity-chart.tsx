"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyActivityPoint } from "../types";
import { axisProps, chartColors, gridProps, tooltipStyle } from "./chart-theme";

interface Props {
  data: DailyActivityPoint[];
}

export function DailyActivityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis
          yAxisId="left"
          {...axisProps}
          label={{ value: "min", position: "insideLeft", offset: 8, style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          {...axisProps}
          domain={[0, 100]}
          label={{ value: "%", position: "insideRight", offset: 8, style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
        />
        <Tooltip {...tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => <span className="text-muted-foreground">{v}</span>}
        />
        <Bar
          yAxisId="left"
          dataKey="watchMinutes"
          name="Watch time"
          fill={chartColors.primary}
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          opacity={0.9}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="attention"
          name="Attention"
          stroke={chartColors.success}
          strokeWidth={2.5}
          dot={{ r: 4, fill: chartColors.success }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
