"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { UsageWindow } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function WindowBurndownChart({ window: w }: { window: UsageWindow }) {
  const data = w.timeline.map((p) => ({
    minute: p.minutesFromStart,
    cumulative: p.cumulativeTokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis
          dataKey="minute"
          tickFormatter={(m: number) => `${m}m`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 300]}
          type="number"
        />
        <YAxis
          tickFormatter={formatNumber}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value: number) => [formatNumber(value), "Cumulative tokens"]}
          labelFormatter={(m: number) => `${m} min into window`}
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <ReferenceLine x={300} stroke="#3f3f46" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#3b82f6"
          fill="#3b82f620"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
