"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/lib/utils";

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

interface Props {
  modelUsage: Record<string, ModelUsage>;
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
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function ModelDistribution({ modelUsage }: Props) {
  const data = Object.entries(modelUsage).map(([model, usage]) => ({
    name: shortModelName(model),
    fullName: model,
    value: usage.inputTokens + usage.outputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Model Distribution (Total Tokens)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            stroke="#0d1117"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.fullName} fill={MODEL_COLORS[entry.fullName] || "#6b7280"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
            itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
            labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
            formatter={(value: number) => [formatTokens(value), "Tokens"]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1 text-sm">
        {data.map((d) => (
          <div key={d.fullName} className="flex justify-between text-textSecondary">
            <span>{d.name}</span>
            <span>{formatTokens(d.value)} ({((d.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
