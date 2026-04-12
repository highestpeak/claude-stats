// src/app/usage/page.tsx
"use client";
import { useState, useEffect } from "react";
import type { UsageCache, UsageWindow } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import WindowBurndownChart from "@/components/WindowBurndownChart";
import HourlyUsageChart from "@/components/HourlyUsageChart";
import WeeklyUsageChart from "@/components/WeeklyUsageChart";
import ExportButton from "@/components/ExportButton";

export default function UsagePage() {
  const [cache, setCache] = useState<UsageCache | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) =>
        r.ok ? r.json() : r.json().then((e: { error: string }) => { throw new Error(e.error); })
      )
      .then(setCache)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="p-6 space-y-2">
        <p className="text-red-400">Error: {error}</p>
        <p className="text-sm text-textSecondary">
          Generate the cache first:{" "}
          <code className="bg-card px-1 py-0.5 rounded text-xs">
            node scripts/collect-usage.mjs
          </code>
        </p>
      </main>
    );
  }

  if (!cache) {
    return <main className="p-6 text-textSecondary">Loading...</main>;
  }

  const totalTokens = cache.windows.reduce((s, w) => s + w.totalTokens, 0);
  const totalRequests = cache.windows.reduce((s, w) => s + w.requestCount, 0);
  const peakWindow: UsageWindow | undefined = cache.windows.reduce<UsageWindow | undefined>(
    (m, w) => (!m || w.totalTokens > m.totalTokens ? w : m),
    undefined
  );

  // Show last 20 windows, newest first
  const recentWindows = [...cache.windows].slice(-20).reverse();
  const selectedWindow = recentWindows[selectedIdx];

  const today = new Date().toISOString().slice(0, 10);
  const filename = `claude-stats-usage-${today}.png`;

  return (
    <main id="usage-page" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-textPrimary">Claude Code Usage</h1>
        <ExportButton targetId="usage-page" filename={filename} />
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={formatNumber(totalRequests)} />
        <StatCard label="All-Time Tokens" value={formatNumber(totalTokens)} />
        <StatCard
          label="Peak Window"
          value={peakWindow ? formatNumber(peakWindow.totalTokens) : "—"}
        />
        <StatCard label="Total Windows" value={formatNumber(cache.windows.length)} />
      </div>

      {/* Window burndown */}
      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-medium text-textSecondary mb-3">
          5-Hour Window Burndown
        </h2>
        {recentWindows.length === 0 ? (
          <p className="text-textSecondary text-sm">No windows recorded yet.</p>
        ) : (
          <div className="flex gap-4">
            {/* Window selector */}
            <div className="w-52 shrink-0">
              <p className="text-xs text-textSecondary mb-2">Recent windows</p>
              <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {recentWindows.map((w, i) => {
                  const start = new Date(w.startTime);
                  return (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelectedIdx(i)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                          i === selectedIdx
                            ? "bg-blue-600 text-white"
                            : "text-textSecondary hover:bg-bg"
                        }`}
                      >
                        <span className="block font-medium">
                          {start.toLocaleDateString()}{" "}
                          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span
                          className={i === selectedIdx ? "text-blue-200" : "text-textSecondary"}
                        >
                          {formatNumber(w.totalTokens)} tokens · {w.requestCount} req
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Burndown chart */}
            <div className="flex-1 min-w-0">
              {selectedWindow && <WindowBurndownChart window={selectedWindow} />}
            </div>
          </div>
        )}
      </section>

      {/* Hourly + Weekly charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-textSecondary mb-3">Hourly Token Usage</h2>
          <HourlyUsageChart data={cache.hourlyAggregates} />
        </section>
        <section className="bg-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-textSecondary mb-3">Weekly Token Usage</h2>
          <WeeklyUsageChart data={cache.weeklyAggregates} />
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl p-4">
      <p className="text-xs text-textSecondary uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-textPrimary mt-1">{value}</p>
    </div>
  );
}
