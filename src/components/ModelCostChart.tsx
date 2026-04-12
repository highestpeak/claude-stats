"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6":           "#a855f7",
  "claude-sonnet-4-6":         "#3b82f6",
  "claude-haiku-4-5-20251001": "#22c55e",
};

function shortName(m: string): string {
  if (m.includes("opus"))   return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku"))  return "Haiku";
  return m;
}

export default function ModelCostChart({ modelUsage }: { modelUsage: Record<string, { costUSD: number }> }) {
  const data = Object.entries(modelUsage)
    .filter(([, u]) => u.costUSD > 0)
    .map(([model, u]) => ({ name: shortName(model), fullName: model, value: u.costUSD }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={55} outerRadius={90}
            dataKey="value" nameKey="name"
            stroke="#0d1117" strokeWidth={2}
          >
            {data.map((e) => (
              <Cell key={e.fullName} fill={MODEL_COLORS[e.fullName] ?? "#6b7280"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
