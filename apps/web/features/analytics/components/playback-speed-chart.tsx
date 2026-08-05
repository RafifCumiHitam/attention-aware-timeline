"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { SpeedDistribution } from "../types";
import { palette, tooltipStyle } from "./chart-theme";

interface Props {
  data: SpeedDistribution[];
}

export function PlaybackSpeedChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="speed"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={95}
          paddingAngle={3}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number, _name, props) => {
            const pct = (props.payload as SpeedDistribution).percentage;
            return [`${value} sessions (${pct}%)`, "Usage"];
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
