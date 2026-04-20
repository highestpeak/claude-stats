"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/lib/utils";
import type { ProjectStats } from "@/lib/types";

/** Extract short project name from full path. e.g. "/Users/x/code/my-project" → "my-project" */
function shortName(fullPath: string): string {
  const parts = fullPath.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || fullPath;
}

export default function ProjectChart({ projects }: { projects: ProjectStats[] }) {
  const data = projects.map(p => ({
    ...p,
    shortName: shortName(p.displayName),
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Top Projects by Messages</h3>
      <ResponsiveContainer width="100%" height={Math.max(250, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            width={140}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
            itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
            labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
            labelFormatter={(_: string, payload: Array<{ payload?: { displayName?: string } }>) => {
              return payload?.[0]?.payload?.displayName ?? '';
            }}
            formatter={(v: number) => [v.toLocaleString(), "Messages"]}
          />
          <Bar dataKey="messageCount" name="Messages" fill="#3b82f6" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
