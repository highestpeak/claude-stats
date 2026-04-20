// src/app/usage/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import type {
  UsageWindowRow,
  WindowTimelineRow,
  HourlyAggregate,
  WeeklyAggregate,
  PaginationInfo,
  UsageWindow,
} from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import WindowBurndownChart from "@/components/WindowBurndownChart";
import HourlyUsageChart from "@/components/HourlyUsageChart";
import WeeklyUsageChart from "@/components/WeeklyUsageChart";
import ExportButton from "@/components/ExportButton";

interface UsageResponse {
  windows: {
    data: UsageWindowRow[];
    pagination: PaginationInfo;
  };
  hourlyAggregates: HourlyAggregate[];
  weeklyAggregates: WeeklyAggregate[];
}

const WINDOWS_PAGE_SIZE = 20;

/** Convert a UsageWindowRow + timeline data into the UsageWindow shape the chart expects */
function toUsageWindow(row: UsageWindowRow, timeline: WindowTimelineRow[]): UsageWindow {
  return {
    id: String(row.id),
    startTime: row.start_time,
    endTime: row.end_time,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    totalTokens: row.total_tokens,
    requestCount: row.request_count,
    timeline: timeline.map((t) => ({
      timestamp: t.timestamp,
      minutesFromStart: t.minutes_from_start,
      tokens: t.tokens,
      cumulativeTokens: t.cumulative_tokens,
    })),
  };
}

export default function UsagePage() {
  const [windows, setWindows]               = useState<UsageWindowRow[]>([]);
  const [windowsPagination, setWindowsPagination] = useState<PaginationInfo | null>(null);
  const [windowsPage, setWindowsPage]       = useState(1);
  const [hourly, setHourly]                 = useState<HourlyAggregate[]>([]);
  const [weekly, setWeekly]                 = useState<WeeklyAggregate[]>([]);
  const [error, setError]                   = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);

  // Selected window + its timeline
  const [selectedWindowId, setSelectedWindowId] = useState<number | null>(null);
  const [timeline, setTimeline]             = useState<WindowTimelineRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Fetch windows (paginated) + aggregates
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(windowsPage));
    params.set("pageSize", String(WINDOWS_PAGE_SIZE));

    fetch(`/api/usage?${params}`)
      .then((r) =>
        r.ok ? r.json() : r.json().then((e: { error: string }) => { throw new Error(e.error); })
      )
      .then((data: UsageResponse) => {
        setWindows(data.windows.data || []);
        setWindowsPagination(data.windows.pagination || null);
        setHourly(data.hourlyAggregates || []);
        setWeekly(data.weeklyAggregates || []);
        setLoading(false);
        // Auto-select first window if none selected
        if (data.windows.data?.length > 0 && selectedWindowId === null) {
          setSelectedWindowId(data.windows.data[0].id);
        }
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowsPage]);

  // Fetch timeline when selected window changes
  const fetchTimeline = useCallback((windowId: number) => {
    setTimelineLoading(true);
    fetch(`/api/usage/${windowId}/timeline`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load timeline");
        return r.json();
      })
      .then((rows: WindowTimelineRow[]) => {
        setTimeline(rows);
        setTimelineLoading(false);
      })
      .catch(() => {
        setTimeline([]);
        setTimelineLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedWindowId !== null) {
      fetchTimeline(selectedWindowId);
    }
  }, [selectedWindowId, fetchTimeline]);

  if (error) {
    return (
      <main className="p-6 space-y-2">
        <p className="text-red-400">Error: {error}</p>
        <p className="text-sm text-textSecondary">
          Populate the database first:{" "}
          <code className="bg-card px-1 py-0.5 rounded text-xs">
            node scripts/collect-to-db.mjs
          </code>{" "}
          or use the Refresh button in the nav bar.
        </p>
      </main>
    );
  }

  if (loading && windows.length === 0) {
    return <main className="p-6 text-textSecondary">Loading...</main>;
  }

  const totalTokens = windowsPagination
    ? windows.reduce((s, w) => s + w.total_tokens, 0)
    : 0;
  const totalRequests = windows.reduce((s, w) => s + w.request_count, 0);
  const peakWindow = windows.reduce<UsageWindowRow | undefined>(
    (m, w) => (!m || w.total_tokens > m.total_tokens ? w : m),
    undefined
  );

  // Build the selected UsageWindow for the chart
  const selectedRow = windows.find((w) => w.id === selectedWindowId);
  const selectedUsageWindow = selectedRow ? toUsageWindow(selectedRow, timeline) : null;

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
        <StatCard label="Requests (page)" value={formatNumber(totalRequests)} />
        <StatCard label="Tokens (page)" value={formatNumber(totalTokens)} />
        <StatCard
          label="Peak Window"
          value={peakWindow ? formatNumber(peakWindow.total_tokens) : "—"}
        />
        <StatCard label="Total Windows" value={windowsPagination ? formatNumber(windowsPagination.total) : "—"} />
      </div>

      {/* Window burndown */}
      <section className="bg-card rounded-xl p-4">
        <h2 className="text-sm font-medium text-textSecondary mb-3">
          5-Hour Window Burndown
        </h2>
        {windows.length === 0 ? (
          <p className="text-textSecondary text-sm">No windows recorded yet.</p>
        ) : (
          <div className="flex gap-4">
            {/* Window selector */}
            <div className="w-52 shrink-0">
              <p className="text-xs text-textSecondary mb-2">Recent windows</p>
              <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {windows.map((w) => {
                  const start = new Date(w.start_time);
                  const isSelected = w.id === selectedWindowId;
                  return (
                    <li key={w.id}>
                      <button
                        onClick={() => setSelectedWindowId(w.id)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "text-textSecondary hover:bg-bg"
                        }`}
                      >
                        <span className="block font-medium">
                          {start.toLocaleDateString()}{" "}
                          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span
                          className={isSelected ? "text-blue-200" : "text-textSecondary"}
                        >
                          {formatNumber(w.total_tokens)} tokens · {w.request_count} req
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* Window pagination */}
              {windowsPagination && windowsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-2 text-xs">
                  <button
                    onClick={() => setWindowsPage((p) => Math.max(1, p - 1))}
                    disabled={windowsPage <= 1}
                    className="px-2 py-1 rounded border border-border text-textSecondary hover:text-textPrimary disabled:opacity-30"
                  >Prev</button>
                  <span className="text-textSecondary">
                    {windowsPagination.page}/{windowsPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setWindowsPage((p) => Math.min(windowsPagination.totalPages, p + 1))}
                    disabled={windowsPage >= windowsPagination.totalPages}
                    className="px-2 py-1 rounded border border-border text-textSecondary hover:text-textPrimary disabled:opacity-30"
                  >Next</button>
                </div>
              )}
            </div>

            {/* Burndown chart */}
            <div className="flex-1 min-w-0">
              {timelineLoading ? (
                <p className="text-textSecondary text-sm py-8 text-center">Loading timeline...</p>
              ) : selectedUsageWindow ? (
                <WindowBurndownChart window={selectedUsageWindow} />
              ) : (
                <p className="text-textSecondary text-sm py-8 text-center">Select a window</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Hourly + Weekly charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-textSecondary mb-3">Hourly Token Usage</h2>
          <HourlyUsageChart data={hourly} />
        </section>
        <section className="bg-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-textSecondary mb-3">Weekly Token Usage</h2>
          <WeeklyUsageChart data={weekly} />
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
