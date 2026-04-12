"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

interface Props {
  dailyModelTokens: DailyModelTokens[];
}

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#a855f7",
  "claude-sonnet-4-6": "#3b82f6",
  "claude-haiku-4-5-20251001": "#22c55e",
};

function shortModelName(name: string): string {
  if (name.includes("opus")) return "Opus";
  if (name.includes("sonnet")) return "Sonnet";
  if (name.includes("haiku")) return "Haiku";
  return name;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function TokensOverTime({ dailyModelTokens }: Props) {
  // Collect all models
  const allModels = new Set<string>();
  for (const d of dailyModelTokens) {
    for (const m of Object.keys(d.tokensByModel)) {
      allModels.add(m);
    }
  }
  const models = Array.from(allModels);

  const data = dailyModelTokens.map((d) => {
    const entry: Record<string, string | number> = { date: d.date.slice(5) }; // MM-DD
    for (const m of models) {
      entry[m] = d.tokensByModel[m] || 0;
    }
    return entry;
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Tokens Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={formatTokens} />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            labelStyle={{ color: "#e6edf3" }}
            formatter={(value: number, name: string) => [formatTokens(value), shortModelName(name)]}
          />
          <Legend formatter={shortModelName} />
          {models.map((m) => (
            <Bar
              key={m}
              dataKey={m}
              stackId="a"
              fill={MODEL_COLORS[m] || "#6b7280"}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
