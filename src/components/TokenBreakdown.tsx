"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const TYPE_COLORS = {
  inputTokens:             "#3b82f6",
  outputTokens:            "#a855f7",
  cacheReadInputTokens:    "#22c55e",
  cacheCreationInputTokens:"#f59e0b",
};

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

function shortName(m: string): string {
  if (m.includes("opus"))   return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku"))  return "Haiku";
  return m;
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export default function TokenBreakdown({ modelUsage }: { modelUsage: Record<string, ModelUsage> }) {
  const data = Object.entries(modelUsage).map(([model, u]) => ({
    name: shortName(model),
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadInputTokens: u.cacheReadInputTokens,
    cacheCreationInputTokens: u.cacheCreationInputTokens,
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Token Breakdown by Model</h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 70)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} width={55} />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [fmt(v)]}
          />
          <Legend />
          <Bar dataKey="inputTokens"              stackId="a" fill={TYPE_COLORS.inputTokens}              name="Input"       />
          <Bar dataKey="outputTokens"             stackId="a" fill={TYPE_COLORS.outputTokens}             name="Output"      />
          <Bar dataKey="cacheReadInputTokens"     stackId="a" fill={TYPE_COLORS.cacheReadInputTokens}     name="Cache Read"  />
          <Bar dataKey="cacheCreationInputTokens" stackId="a" fill={TYPE_COLORS.cacheCreationInputTokens} name="Cache Write" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
