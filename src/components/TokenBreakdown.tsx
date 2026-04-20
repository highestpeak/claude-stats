"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { CHART_TOOLTIP_STYLE } from "@/lib/utils";

const TYPE_COLORS = {
  inputTokens:             "#3b82f6",
  outputTokens:            "#a855f7",
  cacheReadInputTokens:    "#22c55e",
  cacheCreationInputTokens:"#f59e0b",
};

const MODEL_COLORS: Record<string, string> = {
  Opus:   "#a855f7",
  Sonnet: "#3b82f6",
  Haiku:  "#22c55e",
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
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const data = Object.entries(modelUsage).map(([model, u]) => ({
    name: shortName(model),
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadInputTokens: u.cacheReadInputTokens,
    cacheCreationInputTokens: u.cacheCreationInputTokens,
  }));

  const pieData = data.map(d => ({
    name: d.name,
    value: d.inputTokens + d.outputTokens + d.cacheReadInputTokens + d.cacheCreationInputTokens,
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-textPrimary font-semibold">Token Breakdown by Model</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 text-xs rounded ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-textSecondary hover:text-textPrimary'}`}
          >Bar</button>
          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1 text-xs rounded ${chartType === 'pie' ? 'bg-blue-600 text-white' : 'text-textSecondary hover:text-textPrimary'}`}
          >Pie</button>
        </div>
      </div>

      {chartType === 'bar' ? (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 70)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} width={55} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
              itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
              labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
              formatter={(v: number) => [fmt(v)]}
            />
            <Legend />
            <Bar dataKey="inputTokens"              stackId="a" fill={TYPE_COLORS.inputTokens}              name="Input"       />
            <Bar dataKey="outputTokens"             stackId="a" fill={TYPE_COLORS.outputTokens}             name="Output"      />
            <Bar dataKey="cacheReadInputTokens"     stackId="a" fill={TYPE_COLORS.cacheReadInputTokens}     name="Cache Read"  />
            <Bar dataKey="cacheCreationInputTokens" stackId="a" fill={TYPE_COLORS.cacheCreationInputTokens} name="Cache Write" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%">
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={MODEL_COLORS[entry.name] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
              itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
              labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
              formatter={(v: number) => [fmt(v)]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
