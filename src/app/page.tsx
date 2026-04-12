"use client";

import { useEffect, useState } from "react";
import OverviewCards from "@/components/OverviewCards";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import HourlyChart from "@/components/HourlyChart";
import TokensOverTime from "@/components/TokensOverTime";
import ModelDistribution from "@/components/ModelDistribution";
import DeveloperMetrics from "@/components/DeveloperMetrics";
import WeeklyHeatmap from "@/components/WeeklyHeatmap";
import ExportButton from "@/components/ExportButton";

interface StatsData {
  totalSessions: number;
  totalMessages: number;
  hourCounts: Record<string, number>;
  dailyActivity: {
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }[];
  dailyModelTokens: {
    date: string;
    tokensByModel: Record<string, number>;
  }[];
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
  firstSessionDate: string;
  lastComputedDate: string;
}

export default function Home() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-red-400 text-lg">Error: {error}</p>
          <p className="text-textSecondary mt-2 text-sm">
            Make sure ~/.claude/stats-cache.json exists
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary text-lg">Loading stats...</p>
      </div>
    );
  }

  return (
    <main id="export-overview" className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claude Code Stats</h1>
          <p className="text-textSecondary mt-1">
            Since {stats.firstSessionDate?.slice(0, 10) || "N/A"} &middot; Last updated{" "}
            {stats.lastComputedDate || "N/A"}
          </p>
        </div>
        <ExportButton targetId="export-overview" filename={`claude-stats-overview-${new Date().toISOString().slice(0,10)}.png`} />
      </div>

      <div className="space-y-6">
        <OverviewCards
          totalSessions={stats.totalSessions}
          totalMessages={stats.totalMessages}
          modelUsage={stats.modelUsage}
        />

        <ActivityHeatmap dailyActivity={stats.dailyActivity} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HourlyChart hourCounts={stats.hourCounts} />
          <ModelDistribution modelUsage={stats.modelUsage} />
        </div>

        <WeeklyHeatmap
          dailyActivity={stats.dailyActivity}
          hourCounts={stats.hourCounts}
        />

        <TokensOverTime dailyModelTokens={stats.dailyModelTokens} />

        <DeveloperMetrics
          totalSessions={stats.totalSessions}
          totalMessages={stats.totalMessages}
          modelUsage={stats.modelUsage}
          dailyActivity={stats.dailyActivity}
        />
      </div>
    </main>
  );
}
