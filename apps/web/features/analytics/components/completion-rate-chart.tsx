"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompletionPoint } from "../types";
import { axisProps, chartColors, gridProps, tooltipStyle } from "./chart-theme";

interface Props {
  data: CompletionPoint[];
}

export function CompletionRateChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="name"
          {...axisProps}
          tick={{ fontSize: 10 }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis {...axisProps} unit="%" domain={[0, 100]} />
        <Tooltip {...tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => <span className="text-muted-foreground">{v}</span>}
        />
        <Bar dataKey="completed" stackId="a" fill={chartColors.success} name="Completed" radius={[0, 0, 0, 0]} />
        <Bar dataKey="inProgress" stackId="a" fill={chartColors.info} name="In progress" />
        <Bar dataKey="notStarted" stackId="a" fill="hsl(var(--muted-foreground) / 0.25)" name="Not started" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
