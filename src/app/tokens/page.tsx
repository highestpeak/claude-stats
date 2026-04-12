"use client";
import { useEffect, useState } from "react";
import TokenBreakdown from "@/components/TokenBreakdown";
import CacheEfficiency from "@/components/CacheEfficiency";
import ModelCostChart from "@/components/ModelCostChart";
import { formatNumber, formatCurrency } from "@/lib/utils";
import ExportButton from "@/components/ExportButton";

interface StatsData {
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}

export default function TokensPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading...</p>
      </div>
    );
  }

  const totalInput     = Object.values(stats.modelUsage).reduce((s, m) => s + m.inputTokens, 0);
  const totalOutput    = Object.values(stats.modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const totalCacheRead = Object.values(stats.modelUsage).reduce((s, m) => s + m.cacheReadInputTokens, 0);
  const totalCost      = Object.values(stats.modelUsage).reduce((s, m) => s + m.costUSD, 0);

  const summaryCards = [
    { label: "Total Input Tokens",  value: formatNumber(totalInput)     },
    { label: "Total Output Tokens", value: formatNumber(totalOutput)    },
    { label: "Cache Read Tokens",   value: formatNumber(totalCacheRead) },
    { label: "Total Cost",          value: formatCurrency(totalCost)    },
  ];

  return (
    <main id="export-tokens" className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Token Usage</h1>
        <ExportButton targetId="export-tokens" filename={`claude-stats-tokens-${new Date().toISOString().slice(0,10)}.png`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-lg p-5">
            <p className="text-textSecondary text-sm">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <TokenBreakdown modelUsage={stats.modelUsage} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CacheEfficiency modelUsage={stats.modelUsage} />
          <ModelCostChart modelUsage={stats.modelUsage} />
        </div>
      </div>
    </main>
  );
}
