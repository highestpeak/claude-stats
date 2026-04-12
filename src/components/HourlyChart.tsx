"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  hourCounts: Record<string, number>;
}

export default function HourlyChart({ hourCounts }: Props) {
  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: hourCounts[String(i)] || 0,
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Hourly Activity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="hour" tick={{ fill: "#8b949e", fontSize: 11 }} interval={2} />
          <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            labelStyle={{ color: "#e6edf3" }}
            itemStyle={{ color: "#39d353" }}
          />
          <Bar dataKey="count" fill="#39d353" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
