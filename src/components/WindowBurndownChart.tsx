"use client";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { UsageWindow } from "@/lib/types";
import { formatNumber, CHART_TOOLTIP_STYLE } from "@/lib/utils";

interface AveragePoint {
  minute: number;
  avgPct: number;
}

interface Props {
  window: UsageWindow;
  averagePattern?: AveragePoint[];
}

export default function WindowBurndownChart({ window: w, averagePattern }: Props) {
  const totalTokens = w.totalTokens || w.timeline[w.timeline.length - 1]?.cumulativeTokens || 1;

  // Build a merged dataset: actual data + average pattern (scaled to this window's total)
  // Use a Map keyed by minute for efficient merging
  const minuteMap = new Map<number, { minute: number; cumulative?: number; average?: number }>();

  // Add actual timeline points
  for (const p of w.timeline) {
    const m = Math.round(p.minutesFromStart);
    minuteMap.set(m, { minute: m, cumulative: p.cumulativeTokens });
  }

  // Add average pattern points (scaled to this window's total tokens)
  if (averagePattern) {
    for (const p of averagePattern) {
      const existing = minuteMap.get(p.minute);
      const avgValue = p.avgPct * totalTokens;
      if (existing) {
        existing.average = avgValue;
      } else {
        minuteMap.set(p.minute, { minute: p.minute, average: avgValue });
      }
    }
  }

  // Sort by minute
  const data = Array.from(minuteMap.values()).sort((a, b) => a.minute - b.minute);

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
          formatter={(value: number, name: string) => [
            formatNumber(value),
            name === "cumulative" ? "Actual" : "Average",
          ]}
          labelFormatter={(m: number) => `${m} min`}
          contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
          itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
          labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
        />
        <ReferenceLine x={300} stroke="#3f3f46" strokeDasharray="3 3" />
        {averagePattern && (
          <Line
            type="monotone"
            dataKey="average"
            stroke="#8b949e"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            name="average"
            connectNulls
          />
        )}
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#3b82f6"
          fill="#3b82f620"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
          name="cumulative"
          connectNulls
        />
        {averagePattern && (
          <Legend
            formatter={(value: string) => (value === "cumulative" ? "Actual" : "Avg Pattern")}
            wrapperStyle={{ fontSize: 11, color: "#8b949e" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
