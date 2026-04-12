"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { HourlyAggregate } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function HourlyUsageChart({ data }: { data: HourlyAggregate[] }) {
  if (data.length === 0) {
    return <p className="text-textSecondary text-sm">No hourly data available.</p>;
  }

  const chartData = data.map((d) => ({
    // "2026-04-12T10:00:00.000Z" → "04-12 10:00"
    label: d.hour.slice(5, 13).replace("T", " "),
    tokens: d.tokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatNumber}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => [formatNumber(v), "Tokens"]}
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="tokens" fill="#a855f7" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
