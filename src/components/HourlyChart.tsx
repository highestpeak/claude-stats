"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/lib/utils";

interface Props {
  hourCounts: Record<string, number>;
}

function utcHourToLocal(utcHour: number): number {
  const offsetHours = -(new Date().getTimezoneOffset() / 60);
  return ((utcHour + offsetHours) % 24 + 24) % 24;
}

export default function HourlyChart({ hourCounts }: Props) {
  // Convert UTC hour keys to local timezone
  const localCounts: Record<number, number> = {};
  for (const [utcH, count] of Object.entries(hourCounts)) {
    const localH = utcHourToLocal(Number(utcH));
    localCounts[localH] = (localCounts[localH] || 0) + count;
  }

  const data = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    count: localCounts[i] || 0,
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
            contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
            itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
            labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
          />
          <Bar dataKey="count" fill="#39d353" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
