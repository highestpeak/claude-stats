"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ProjectStats } from "@/lib/types";

export default function ProjectChart({ projects }: { projects: ProjectStats[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Top Projects by Messages</h3>
      <ResponsiveContainer width="100%" height={Math.max(250, projects.length * 32)}>
        <BarChart data={projects} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            width={170}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [v.toLocaleString(), "Messages"]}
          />
          <Bar dataKey="messageCount" name="Messages" fill="#3b82f6" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
